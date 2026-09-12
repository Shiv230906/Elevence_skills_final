require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const User = require("./Model/User");
const PasswordReset = require("./Model/PasswordReset");
const LoginHistory = require("./Model/LoginHistory");
const { generateAlphaPassword } = require("./utils/passwordGenerator");

const BASE_URL = "http://localhost:5000";

async function runTestSuite() {
  console.log("==========================================================");
  console.log("   STARTING COMPREHENSIVE AUTHENTICATION TEST SUITE       ");
  console.log("==========================================================\n");

  await mongoose.connect(process.env.DATABASE_URL);
  console.log("✓ Connected to MongoDB database successfully.\n");

  const timestamp = Date.now();
  const testUserEmail = `auth_test_user_${timestamp}@example.com`;
  const testUsername = `user_${timestamp}`;
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPassword = "SecurePassword123";
  const testFirebaseUid = `fb_uid_${timestamp}`;

  // --------------------------------------------------------------------------
  // TEST 1: Password Generator Constraints: Only [a-zA-Z], No Numbers, No Symbols
  // --------------------------------------------------------------------------
  console.log("[TEST 1] Testing Password Generator Constraints...");
  for (let i = 0; i < 20; i++) {
    const pwd = generateAlphaPassword(12);
    if (!/^[a-zA-Z]{12}$/.test(pwd)) {
      throw new Error(`TEST 1 FAILED: Password contains invalid characters: ${pwd}`);
    }
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasDigits = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);

    if (!hasUpper || !hasLower || hasDigits || hasSpecial) {
      throw new Error(`TEST 1 FAILED: Character rules violated: ${pwd}`);
    }
  }
  console.log("✓ TEST 1 PASSED: 20 generated passwords strictly match [A-Za-z] with no digits/symbols.\n");

  // --------------------------------------------------------------------------
  // TEST 2: User Registration -> Profile created in Database with Firebase UID
  // --------------------------------------------------------------------------
  console.log("[TEST 2] Testing User Registration & Database Storage...");
  // Check uniqueness check endpoint
  const checkRes = await axios.post(`${BASE_URL}/api/auth/check-exists`, {
    email: testUserEmail,
    username: testUsername,
    phone: testPhone,
  });
  if (checkRes.data.exists) {
    throw new Error("TEST 2 FAILED: User should not already exist");
  }

  // Register user
  const regRes = await axios.post(`${BASE_URL}/api/auth/register`, {
    firebaseUid: testFirebaseUid,
    fullName: "Shivani Test User",
    email: testUserEmail,
    phone: testPhone,
    username: testUsername,
    password: testPassword,
  });

  if (!regRes.data.success || !regRes.data.user) {
    throw new Error("TEST 2 FAILED: Failed to register user in database");
  }

  // Verify in MongoDB
  const savedUser = await User.findOne({ firebaseUid: testFirebaseUid });
  if (!savedUser) {
    throw new Error("TEST 2 FAILED: User document not found in MongoDB!");
  }
  if (!savedUser.password || !bcrypt.compareSync(testPassword, savedUser.password)) {
    throw new Error("TEST 2 FAILED: Password was not hashed with bcrypt properly!");
  }
  console.log(`✓ TEST 2 PASSED: User registered with UID ${testFirebaseUid} and stored in MongoDB.\n`);

  // --------------------------------------------------------------------------
  // TEST 3: User Profile Retrieval using Firebase UID
  // --------------------------------------------------------------------------
  console.log("[TEST 3] Testing Profile Retrieval by Firebase UID...");
  const profileRes = await axios.get(`${BASE_URL}/api/auth/profile/${testFirebaseUid}`);
  if (!profileRes.data.success || profileRes.data.user.email !== testUserEmail) {
    throw new Error("TEST 3 FAILED: Could not retrieve user profile by Firebase UID");
  }
  console.log(`✓ TEST 3 PASSED: Retrieved user profile: ${profileRes.data.user.name} (${profileRes.data.user.email})\n`);

  // --------------------------------------------------------------------------
  // TEST 4: Wrong Password -> Normal Login Blocked
  // --------------------------------------------------------------------------
  console.log("[TEST 4] Testing Wrong Password Rejection...");
  try {
    await axios.post(`${BASE_URL}/api/auth/validate-login`, {
      identifier: testUserEmail,
      password: "WrongPassword999",
    });
    throw new Error("TEST 4 FAILED: Wrong password should have been rejected!");
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log(`✓ TEST 4 PASSED: Wrong password rejected with 401: "${err.response.data.message}"\n`);
    } else {
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 5: Normal Login with Email -> Triggers OTP -> Verify OTP -> Home Access
  // --------------------------------------------------------------------------
  console.log("[TEST 5] Testing Normal Login Flow (Email + Password + OTP)...");
  const loginRes = await axios.post(`${BASE_URL}/api/auth/validate-login`, {
    identifier: testUserEmail,
    password: testPassword,
  });

  if (!loginRes.data.success || !loginRes.data.requiresOtp) {
    throw new Error("TEST 5 FAILED: Expected requiresOtp: true for normal login!");
  }
  const loginOtp = loginRes.data.devOtp;
  const historyId = loginRes.data.historyId;
  console.log(`✓ Login credentials validated. Received OTP: ${loginOtp}`);

  // Try wrong OTP
  try {
    await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
      firebaseUid: testFirebaseUid,
      userEmail: testUserEmail,
      otp: "000000",
      historyId,
    });
    throw new Error("TEST 5 FAILED: Wrong OTP was accepted!");
  } catch (err) {
    if (err.response?.status === 400) {
      console.log("✓ Wrong OTP correctly rejected with 400.");
    } else {
      throw err;
    }
  }

  // Verify correct OTP
  const verifyRes = await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
    firebaseUid: testFirebaseUid,
    userEmail: testUserEmail,
    otp: loginOtp,
    historyId,
  });

  if (!verifyRes.data.allowed || !verifyRes.data.success) {
    throw new Error("TEST 5 FAILED: Expected OTP verification success!");
  }

  // Verify lastLoginAt in MongoDB
  const updatedUserDoc = await User.findOne({ firebaseUid: testFirebaseUid });
  if (!updatedUserDoc.lastLoginAt) {
    throw new Error("TEST 5 FAILED: lastLoginAt was not updated in User document!");
  }
  console.log(`✓ TEST 5 PASSED: OTP verified successfully. lastLoginAt updated: ${updatedUserDoc.lastLoginAt}\n`);

  // --------------------------------------------------------------------------
  // TEST 6: Normal Login with Username -> Triggers OTP
  // --------------------------------------------------------------------------
  console.log("[TEST 6] Testing Normal Login via Username...");
  const usernameLoginRes = await axios.post(`${BASE_URL}/api/auth/validate-login`, {
    identifier: testUsername,
    password: testPassword,
  });
  if (!usernameLoginRes.data.success || !usernameLoginRes.data.requiresOtp) {
    throw new Error("TEST 6 FAILED: Login via username failed!");
  }
  console.log(`✓ TEST 6 PASSED: Normal login via username '${testUsername}' succeeded and triggered OTP.\n`);

  // --------------------------------------------------------------------------
  // TEST 7: Google Login -> Triggers OTP -> Verify OTP
  // --------------------------------------------------------------------------
  console.log("[TEST 7] Testing Google Login Flow (login-check + OTP)...");
  const googleRes = await axios.post(`${BASE_URL}/api/auth/login-check`, {
    firebaseUid: testFirebaseUid,
    userEmail: testUserEmail,
    loginType: "google",
    isGoogleLogin: true,
  });

  if (!googleRes.data.requiresOtp) {
    throw new Error("TEST 7 FAILED: Google login must require OTP verification!");
  }
  const googleOtp = googleRes.data.devOtp;
  const googleHistoryId = googleRes.data.historyId;

  // Verify Google OTP
  const verifyGoogle = await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
    firebaseUid: testFirebaseUid,
    userEmail: testUserEmail,
    otp: googleOtp,
    historyId: googleHistoryId,
  });
  if (!verifyGoogle.data.allowed) {
    throw new Error("TEST 7 FAILED: Google OTP verification failed!");
  }
  console.log("✓ TEST 7 PASSED: Google login requires and verifies OTP successfully.\n");

  // --------------------------------------------------------------------------
  // TEST 8: Forgot Password via Registered Email -> OTP -> Verify -> Generate -> Reset
  // --------------------------------------------------------------------------
  console.log("[TEST 8] Testing Complete Forgot Password Flow via Registered Email...");
  // Clear lastResetRequestDate to allow fresh test
  await User.updateOne({ email: testUserEmail }, { $set: { lastResetRequestDate: null } });

  const forgotReq = await axios.post(`${BASE_URL}/api/auth/forgot-password/request`, {
    identifier: testUserEmail,
  });

  if (!forgotReq.data.success || !forgotReq.data.resetToken) {
    throw new Error("TEST 8 FAILED: Forgot password request failed");
  }
  const resetToken = forgotReq.data.resetToken;

  // Get OTP from MongoDB
  const resetRecord = await PasswordReset.findOne({ resetToken });
  if (!resetRecord) {
    throw new Error("TEST 8 FAILED: PasswordReset record not created in DB");
  }
  const resetOtp = resetRecord.otp;

  // Step 2: Verify OTP
  const verifyOtpRes = await axios.post(`${BASE_URL}/api/auth/forgot-password/verify-otp`, {
    resetToken,
    otp: resetOtp,
  });
  if (!verifyOtpRes.data.success) {
    throw new Error("TEST 8 FAILED: OTP verification failed in forgot password");
  }
  console.log("✓ OTP verified in forgot password step.");

  // Step 3: Generate Password
  const genRes = await axios.post(`${BASE_URL}/api/auth/forgot-password/generate-password`);
  if (!genRes.data.success || !genRes.data.generatedPassword) {
    throw new Error("TEST 8 FAILED: Failed to generate password");
  }
  const newGeneratedPassword = genRes.data.generatedPassword;
  console.log(`✓ Generated new password: ${newGeneratedPassword}`);

  // Step 4: Complete reset
  const completeRes = await axios.post(`${BASE_URL}/api/auth/forgot-password/complete`, {
    resetToken,
    newPassword: newGeneratedPassword,
  });
  if (!completeRes.data.success) {
    throw new Error("TEST 8 FAILED: Failed to complete password reset");
  }

  // Verify login with newly generated password
  const newLoginRes = await axios.post(`${BASE_URL}/api/auth/validate-login`, {
    identifier: testUserEmail,
    password: newGeneratedPassword,
  });
  if (!newLoginRes.data.success || !newLoginRes.data.requiresOtp) {
    throw new Error("TEST 8 FAILED: Login with new generated password failed!");
  }
  console.log("✓ TEST 8 PASSED: Forgot Password full cycle completed and verified.\n");

  // --------------------------------------------------------------------------
  // TEST 9: Forgot Password via Registered Phone
  // --------------------------------------------------------------------------
  console.log("[TEST 9] Testing Forgot Password via Registered Phone...");
  // Clear lastResetRequestDate for phone test
  await User.updateOne({ phone: testPhone }, { $set: { lastResetRequestDate: null } });

  const phoneForgotReq = await axios.post(`${BASE_URL}/api/auth/forgot-password/request`, {
    identifier: testPhone,
  });
  if (!phoneForgotReq.data.success || !phoneForgotReq.data.resetToken) {
    throw new Error("TEST 9 FAILED: Forgot password via phone failed");
  }
  console.log(`✓ TEST 9 PASSED: Forgot password initiated using phone ${testPhone}.\n`);

  // --------------------------------------------------------------------------
  // TEST 10: One Password Reset Per Day Restriction (429)
  // --------------------------------------------------------------------------
  console.log("[TEST 10] Testing One Password Reset Per Day Restriction...");
  try {
    await axios.post(`${BASE_URL}/api/auth/forgot-password/request`, {
      identifier: testPhone,
    });
    throw new Error("TEST 10 FAILED: Second reset request on the same day should be blocked!");
  } catch (err) {
    if (err.response && err.response.status === 429) {
      if (err.response.data.message === "You can use this option only once per day.") {
        console.log(`✓ TEST 10 PASSED: Second attempt blocked with exact message: "${err.response.data.message}"\n`);
      } else {
        throw new Error(`TEST 10 FAILED: Unexpected message: ${err.response.data.message}`);
      }
    } else {
      throw err;
    }
  }

  console.log("==========================================================");
  console.log("   ALL 10 AUTHENTICATION FLOW TESTS PASSED SUCCESSFULLY!  ");
  console.log("==========================================================\n");

  // Clean up test user
  await User.deleteOne({ firebaseUid: testFirebaseUid });
  await PasswordReset.deleteMany({ userId: savedUser._id });
  await LoginHistory.deleteMany({ firebaseUid: testFirebaseUid });

  await mongoose.disconnect();
  process.exit(0);
}

runTestSuite().catch(async (err) => {
  console.error("\n❌ TEST SUITE FAILED:", err.response?.data || err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
