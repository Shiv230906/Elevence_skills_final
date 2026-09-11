require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const User = require("./Model/User");
const Resume = require("./Model/Resume");
const PasswordReset = require("./Model/PasswordReset");
const { generateAlphaPassword } = require("./utils/passwordGenerator");

const BASE_URL = "http://localhost:5000";

async function runTests() {
  console.log("=== STARTING FORGOT PASSWORD AUTOMATED TESTS ===");
  await mongoose.connect(process.env.DATABASE_URL);
  console.log("Connected to MongoDB successfully.\n");

  // TEST 1: Password Generator Unit Verification
  console.log("--- TEST 1: Password Generator Constraints ---");
  for (let i = 0; i < 20; i++) {
    const pwd = generateAlphaPassword(12);
    if (!/^[a-zA-Z]{12}$/.test(pwd)) {
      throw new Error(`Password generator failed constraint on iteration ${i}: ${pwd}`);
    }
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasDigits = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);

    if (!hasUpper || !hasLower || hasDigits || hasSpecial) {
      throw new Error(`Password failed character rules: ${pwd}`);
    }
  }
  console.log("PASSED: 20 generated passwords verified. Strictly uppercase and lowercase English letters ONLY. No numbers, no special chars.\n");

  // TEST 2: Unregistered Account Rejection (404)
  console.log("--- TEST 2: Unregistered Account Rejection ---");
  try {
    await axios.post(`${BASE_URL}/api/auth/forgot-password/request`, {
      identifier: "nonexistent_user_999@randomdomain123.com",
    });
    console.error("FAILED: Expected 404 for unregistered email");
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.log(`PASSED: Unregistered email properly rejected with 404: "${err.response.data.message}"`);
    } else {
      throw err;
    }
  }

  // Clear any existing reset timestamps for the test user to start fresh
  const testEmail = "shivanif53@gmail.com";
  await User.updateOne({ email: testEmail }, { $set: { lastResetRequestDate: null } });

  // TEST 3: Valid Registered Account Reset Request
  console.log("\n--- TEST 3: Valid Registered Account Reset Request ---");
  const reqRes = await axios.post(`${BASE_URL}/api/auth/forgot-password/request`, {
    identifier: testEmail,
  });

  console.log("Response status:", reqRes.status);
  console.log("Response payload:", reqRes.data);

  if (!reqRes.data.success || !reqRes.data.resetToken) {
    throw new Error("Failed to receive success and resetToken");
  }

  // Verify OTP is NOT exposed in response
  if (reqRes.data.otp || reqRes.data.devOtp) {
    throw new Error("SECURITY VIOLATION: OTP was exposed in response!");
  }
  console.log("PASSED: OTP was NOT exposed in frontend response.");
  console.log("Masked contact returned:", reqRes.data.maskedContact);

  const resetToken = reqRes.data.resetToken;

  // TEST 4: Once-Per-Day Restriction Enforcement (429)
  console.log("\n--- TEST 4: Once-Per-Day Restriction Enforcement ---");
  try {
    await axios.post(`${BASE_URL}/api/auth/forgot-password/request`, {
      identifier: testEmail,
    });
    console.error("FAILED: Expected second request on same day to be blocked!");
  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.log(`PASSED: Second request blocked with 429: "${err.response.data.message}"`);
      if (err.response.data.message !== "You can use this option only once per day.") {
        throw new Error(`Expected message 'You can use this option only once per day.', got: ${err.response.data.message}`);
      }
    } else {
      throw new Error(`Unexpected status code: ${err.response ? err.response.status : err.message}`);
    }
  }

  // TEST 5: Verify with Invalid OTP
  console.log("\n--- TEST 5: Verify with Invalid OTP ---");
  try {
    await axios.post(`${BASE_URL}/api/auth/forgot-password/verify`, {
      resetToken,
      otp: "000000",
    });
    console.error("FAILED: Expected invalid OTP to be rejected");
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log(`PASSED: Invalid OTP rejected with: "${err.response.data.message}"`);
    } else {
      throw err;
    }
  }

  // Retrieve stored OTP from database for testing valid flow
  const storedRecord = await PasswordReset.findOne({ resetToken });
  if (!storedRecord) {
    throw new Error("PasswordReset record not found in database");
  }
  const actualOtp = storedRecord.otp;
  console.log(`\n(DB check: found stored OTP for verification test: ${actualOtp})`);

  // TEST 6: Verify with Correct OTP
  console.log("\n--- TEST 6: Verify with Correct OTP ---");
  const verifyRes = await axios.post(`${BASE_URL}/api/auth/forgot-password/verify`, {
    resetToken,
    otp: actualOtp,
  });

  console.log("Verify Response:", verifyRes.data);
  if (!verifyRes.data.success || !verifyRes.data.generatedPassword) {
    throw new Error("Expected successful verification and generatedPassword");
  }

  const generatedPassword = verifyRes.data.generatedPassword;
  console.log(`Generated Password: ${generatedPassword}`);

  // Assert generated password constraints
  if (!/^[a-zA-Z]{12}$/.test(generatedPassword)) {
    throw new Error(`Generated password failed constraint: ${generatedPassword}`);
  }
  console.log("PASSED: Generated password contains ONLY [a-zA-Z], length is 12.");

  // Verify User record in DB has hashed password
  const updatedUser = await User.findById(storedRecord.userId);
  if (!updatedUser || !updatedUser.password) {
    throw new Error("User record does not contain updated password hash!");
  }

  const isHashMatch = bcrypt.compareSync(generatedPassword, updatedUser.password);
  if (!isHashMatch) {
    throw new Error("Stored bcrypt hash does not match generated password!");
  }
  console.log("PASSED: Database stored password is a valid bcrypt hash of the generated password.");

  // TEST 7: OTP Single-Use Check (Reuse Prevention)
  console.log("\n--- TEST 7: OTP Reuse Prevention ---");
  try {
    await axios.post(`${BASE_URL}/api/auth/forgot-password/verify`, {
      resetToken,
      otp: actualOtp,
    });
    console.error("FAILED: Expected used OTP to be rejected!");
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log(`PASSED: Reusing OTP rejected: "${err.response.data.message}"`);
    } else {
      throw err;
    }
  }

  // TEST 8: Admin Login with New Password
  console.log("\n--- TEST 8: Admin Login with New Password ---");
  const loginRes = await axios.post(`${BASE_URL}/api/admin/adminlogin`, {
    username: testEmail,
    password: generatedPassword,
  });
  console.log("Admin login response with new password:", loginRes.data);
  if (loginRes.data !== "admin is here") {
    throw new Error(`Admin login failed with new password, got: ${loginRes.data}`);
  }
  console.log("PASSED: Admin successfully logged in with the new generated password!");

  console.log("\n==========================================");
  console.log("ALL FORGOT PASSWORD BACKEND TESTS PASSED!");
  console.log("==========================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("Test failed with error:", err.response ? err.response.data : err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
