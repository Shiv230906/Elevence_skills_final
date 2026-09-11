const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const GOOGLE_USER_EMAIL = `google_user_${Date.now()}@gmail.com`;
const GOOGLE_USER_UID = `google_uid_${Date.now()}`;
const NORMAL_USER_EMAIL = `normal_user_${Date.now()}@example.com`;
const NORMAL_USER_UID = `normal_uid_${Date.now()}`;

async function runTests() {
  console.log('--- STARTING LOGIN FLOW INTEGRATION TESTS ---\n');

  // TEST 1: Normal email/password login -> Home directly (NO OTP required)
  console.log('[TEST 1] Normal Email/Password Login...');
  const normalRes = await axios.post(`${BASE_URL}/api/auth/login-check`, {
    userEmail: NORMAL_USER_EMAIL,
    firebaseUid: NORMAL_USER_UID,
    loginType: 'password',
    isGoogleLogin: false,
  });

  console.log('Normal login response:', normalRes.data);
  if (normalRes.data.requiresOtp === true) {
    throw new Error('FAILED: Normal login should NOT require OTP!');
  }
  if (!normalRes.data.allowed) {
    throw new Error('FAILED: Normal login should be allowed directly!');
  }
  console.log('✓ TEST 1 PASSED: Normal email/password login allows direct access to Home without OTP.\n');

  // TEST 2: Continue with Google -> triggers OTP verification
  console.log('[TEST 2] Continue with Google Authentication...');
  const googleRes = await axios.post(`${BASE_URL}/api/auth/login-check`, {
    userEmail: GOOGLE_USER_EMAIL,
    firebaseUid: GOOGLE_USER_UID,
    loginType: 'google',
    isGoogleLogin: true,
  });

  console.log('Google login check response:', googleRes.data);
  if (!googleRes.data.requiresOtp) {
    throw new Error('FAILED: Google login MUST require OTP verification!');
  }
  const otpCode = googleRes.data.devOtp;
  const historyId = googleRes.data.historyId;
  console.log(`✓ TEST 2 PASSED: Google login redirects to OTP page & dispatched OTP: ${otpCode}\n`);

  // TEST 3: Wrong OTP -> remains on OTP page with error
  console.log('[TEST 3] Testing Wrong OTP rejection...');
  try {
    await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
      userEmail: GOOGLE_USER_EMAIL,
      otp: '999999',
      firebaseUid: GOOGLE_USER_UID,
      historyId,
    });
    throw new Error('FAILED: Wrong OTP should not be accepted!');
  } catch (err) {
    console.log('Correctly rejected wrong OTP:', err.response?.data?.message);
    if (err.response?.status !== 400) {
      throw new Error(`Expected 400 status, got ${err.response?.status}`);
    }
  }
  console.log('✓ TEST 3 PASSED: Wrong OTP properly rejected with clear error.\n');

  // TEST 4: Expired / Not Found OTP
  console.log('[TEST 4] Testing Expired / Non-existent OTP...');
  try {
    await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
      userEmail: 'nonexistent_user@example.com',
      otp: '123456',
      firebaseUid: 'fake_uid',
      historyId: null,
    });
    throw new Error('FAILED: Expired/Non-existent OTP should not be accepted!');
  } catch (err) {
    console.log('Correctly rejected expired/not found OTP:', err.response?.data?.message);
    if (err.response?.status !== 400) {
      throw new Error(`Expected 400 status, got ${err.response?.status}`);
    }
  }
  console.log('✓ TEST 4 PASSED: Expired/Non-existent OTP properly rejected.\n');

  // TEST 5: Correct OTP verification -> successfully allowed to access Home
  console.log('[TEST 5] Testing Correct OTP verification...');
  const verifyRes = await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
    userEmail: GOOGLE_USER_EMAIL,
    otp: otpCode,
    firebaseUid: GOOGLE_USER_UID,
    historyId,
  });

  console.log('Verification response:', verifyRes.data);
  if (!verifyRes.data.allowed || !verifyRes.data.success) {
    throw new Error('FAILED: Expected valid OTP to be verified!');
  }
  console.log('✓ TEST 5 PASSED: Correct OTP verified successfully -> Home access granted.\n');

  // TEST 6: Resend OTP for Google User
  console.log('[TEST 6] Testing Resend OTP for Google User...');
  const resendRes = await axios.post(`${BASE_URL}/api/auth/login-check`, {
    userEmail: GOOGLE_USER_EMAIL,
    firebaseUid: GOOGLE_USER_UID,
    loginType: 'google',
    isGoogleLogin: true,
  });
  console.log('Resend OTP response:', resendRes.data);
  if (!resendRes.data.requiresOtp) {
    throw new Error('FAILED: Resend OTP should generate a new OTP!');
  }
  console.log('✓ TEST 6 PASSED: Resend OTP generated and sent successfully.\n');

  console.log('========================================');
  console.log('ALL LOGIN FLOW TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('TEST SUITE FAILED:', err.response?.data || err.message);
  process.exit(1);
});
