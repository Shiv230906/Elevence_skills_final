require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const User = require("./Model/User");
const { sendOTPEmail, sendFastEmail } = require("./utils/mailer");

const BASE_URL = "http://localhost:5000";

async function runTests() {
  console.log("===============================================================");
  console.log("   COMPREHENSIVE OTP & RESEND EMAIL DELIVERY TEST SUITE        ");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: mailer.js sendOTPEmail function interface & output structure
  // --------------------------------------------------------------------------
  console.log("\n[TEST 1] Testing sendOTPEmail interface...");
  const mailResult = await sendOTPEmail("testuser@example.com", "123456", "login");
  assert(mailResult && (mailResult.success || mailResult.devMode), "sendOTPEmail returns success/devMode without crashing");
  console.log("Result:", mailResult);

  // --------------------------------------------------------------------------
  // TEST 2: Database connection
  // --------------------------------------------------------------------------
  console.log("\n[TEST 2] Testing MongoDB Connection...");
  await mongoose.connect(process.env.DATABASE_URL);
  assert(mongoose.connection.readyState === 1, "Connected to MongoDB successfully");

  // Create a dedicated test user for credentials testing
  const testEmail = `otp_test_${Date.now()}@example.com`;
  const testPassword = "ValidPassword123";
  const hashedPassword = bcrypt.hashSync(testPassword, 10);
  const testUser = new User({
    name: "OTP Test User",
    email: testEmail,
    password: hashedPassword,
    role: "user",
  });
  await testUser.save();
  console.log(`Created test user: ${testEmail}`);

  try {
    // --------------------------------------------------------------------------
    // TEST 3: Login Endpoint (POST /api/auth/validate-login)
    // --------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Login Endpoint (/api/auth/validate-login)...");
    const loginRes = await axios.post(`${BASE_URL}/api/auth/validate-login`, {
      identifier: testEmail,
      password: testPassword,
    });
    assert(loginRes.status === 200, "Login returns 200 OK");
    assert(loginRes.data.success === true, "Login returns success: true");
    assert(loginRes.data.requiresOtp === true, "Login returns requiresOtp: true");
    assert(loginRes.data.email === testEmail, "Login returns correct user email");
    const firstOtp = loginRes.data.devOtp;
    assert(typeof firstOtp === "string" && firstOtp.length === 6 && /^\d{6}$/.test(firstOtp), "Valid 6-digit OTP generated");
    console.log(`Generated first OTP: ${firstOtp}`);

    // --------------------------------------------------------------------------
    // TEST 4: Invalid OTP Verification (POST /api/auth/verify-login-otp)
    // --------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing Invalid OTP Verification...");
    try {
      await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
        userEmail: testEmail,
        otp: "000000" === firstOtp ? "111111" : "000000",
      });
      assert(false, "Invalid OTP should return 400 error");
    } catch (err) {
      assert(err.response && err.response.status === 400, "Invalid OTP rejected with status 400");
      assert(err.response.data.message.includes("Invalid OTP"), "Returns descriptive 'Invalid OTP' message");
    }

    // --------------------------------------------------------------------------
    // TEST 5: Resend OTP Endpoint (POST /api/auth/resend-login-otp)
    // --------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing Resend OTP Endpoint (/api/auth/resend-login-otp)...");
    const resendRes = await axios.post(`${BASE_URL}/api/auth/resend-login-otp`, {
      userEmail: testEmail,
      loginType: "credentials",
    });
    assert(resendRes.status === 200, "Resend returns 200 OK");
    assert(resendRes.data.success === true, "Resend returns success: true");
    assert(resendRes.data.requiresOtp === true, "Resend returns requiresOtp: true");
    const secondOtp = resendRes.data.devOtp;
    assert(typeof secondOtp === "string" && secondOtp.length === 6 && /^\d{6}$/.test(secondOtp), "Fresh 6-digit OTP generated on resend");
    console.log(`Generated second (fresh) OTP: ${secondOtp}`);

    // --------------------------------------------------------------------------
    // TEST 6: Expired OTP Verification
    // --------------------------------------------------------------------------
    console.log("\n[TEST 6] Testing Expired OTP rejection...");
    // Verify that non-existent/expired email returns 400
    try {
      await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
        userEmail: "non_existent_expired@example.com",
        otp: "123456",
      });
      assert(false, "Non-existent/expired OTP should return 400");
    } catch (err) {
      assert(err.response && err.response.status === 400, "Expired/not-found OTP rejected with status 400");
      assert(err.response.data.message.includes("OTP not found or expired"), "Returns 'OTP not found or expired' message");
    }

    // --------------------------------------------------------------------------
    // TEST 7: Successful OTP Verification (POST /api/auth/verify-login-otp)
    // --------------------------------------------------------------------------
    console.log("\n[TEST 7] Testing Valid OTP Verification...");
    const verifyRes = await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
      userEmail: testEmail,
      otp: secondOtp,
    });
    assert(verifyRes.status === 200, "Valid OTP returns 200 OK");
    assert(verifyRes.data.allowed === true, "Returns allowed: true");
    assert(verifyRes.data.success === true, "Returns success: true");

    // --------------------------------------------------------------------------
    // TEST 8: One-Time Use (Replay Attack Prevention)
    // --------------------------------------------------------------------------
    console.log("\n[TEST 8] Testing OTP One-Time Use (Cannot be re-used)...");
    try {
      await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
        userEmail: testEmail,
        otp: secondOtp,
      });
      assert(false, "Re-using verified OTP should return 400");
    } catch (err) {
      assert(err.response && err.response.status === 400, "Used OTP rejected on replay (status 400)");
    }

    // --------------------------------------------------------------------------
    // TEST 9: General OTP Routes (POST /api/otp/send & /api/otp/verify)
    // --------------------------------------------------------------------------
    console.log("\n[TEST 9] Testing /api/otp/send and /api/otp/verify...");
    const generalSendRes = await axios.post(`${BASE_URL}/api/otp/send`, {
      email: testEmail,
    });
    assert(generalSendRes.status === 200, "General OTP /send returns 200 OK");
    const generalOtp = generalSendRes.data.devOtp;
    assert(typeof generalOtp === "string" && generalOtp.length === 6, "General OTP is 6 digits");

    const generalVerifyRes = await axios.post(`${BASE_URL}/api/otp/verify`, {
      email: testEmail,
      otp: generalOtp,
    });
    assert(generalVerifyRes.status === 200, "General OTP /verify returns 200 OK");
    assert(generalVerifyRes.data.success === true, "General OTP verified successfully");

  } finally {
    // Cleanup test user
    await User.deleteOne({ email: testEmail });
    await mongoose.disconnect();
    console.log("\nCleaned up test user and disconnected MongoDB.");
  }

  console.log("\n===============================================================");
  console.log(`   ALL TESTS PASSED! (${passed} checks passed, 0 failures)     `);
  console.log("===============================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
