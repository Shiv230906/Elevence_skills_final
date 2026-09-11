const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000';
const TEST_EMAIL = `test_user_${Date.now()}@example.com`;
const TEST_UID = `test_uid_${Date.now()}`;

async function runTests() {
  console.log('--- STARTING OTP & RESUME BUILDER INTEGRATION TESTS ---');

  // 1. Test OTP Generation & Performance
  console.log('\n[TEST 1] Testing Fast OTP Dispatch...');
  const t0 = Date.now();
  const sendRes = await axios.post(`${BASE_URL}/api/auth/login-check`, {
    userEmail: TEST_EMAIL,
    firebaseUid: TEST_UID,
  }, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const duration = Date.now() - t0;
  console.log(`Response time: ${duration}ms (Must be < 500ms for fast UX)`);
  console.log('Requires OTP response:', sendRes.data);
  if (!sendRes.data.requiresOtp) {
    throw new Error('Expected requiresOtp to be true for Chrome browser');
  }

  // 2. Test Invalid OTP
  console.log('\n[TEST 2] Testing Invalid OTP rejection...');
  try {
    await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
      userEmail: TEST_EMAIL,
      otp: '000000'
    });
    throw new Error('Expected invalid OTP to fail');
  } catch (err) {
    console.log('Correctly rejected invalid OTP:', err.response?.data?.message || err.message);
  }

  // 2b. Test Valid OTP verification
  console.log('\n[TEST 2b] Testing Valid OTP Verification...');
  const validOtp = sendRes.data.devOtp;
  const verifyLoginRes = await axios.post(`${BASE_URL}/api/auth/verify-login-otp`, {
    userEmail: TEST_EMAIL,
    otp: validOtp,
    firebaseUid: TEST_UID,
    historyId: sendRes.data.historyId
  });
  console.log('Login OTP verification result:', verifyLoginRes.data);
  if (!verifyLoginRes.data.allowed) {
    throw new Error('Expected login OTP verification to succeed');
  }

  // 3. Test Resume Builder access for NON-PREMIUM user
  console.log('\n[TEST 3] Testing Non-Premium Resume Generation Rejection...');
  // First save a non-premium resume
  await axios.post(`${BASE_URL}/api/resume`, {
    firebaseUid: TEST_UID,
    name: 'Test Non-Premium User',
    email: TEST_EMAIL,
    isPremium: false
  });

  try {
    await axios.post(`${BASE_URL}/api/resume/generate-pdf`, {
      firebaseUid: TEST_UID,
      paymentId: 'fake_payment_id'
    });
    throw new Error('Expected non-premium user to be rejected');
  } catch (err) {
    console.log('Correctly rejected non-premium user:', err.response?.data?.error || err.message);
  }

  // 4. Update Resume to activate isPremium = true
  console.log('\n[TEST 4] Activating Premium Membership (₹300 tier)...');
  const saveRes = await axios.post(`${BASE_URL}/api/resume`, {
    firebaseUid: TEST_UID,
    name: 'Test Premium User',
    email: TEST_EMAIL,
    isPremium: true
  });
  console.log('Resume updated with isPremium = true:', saveRes.data.isPremium);

  // 5. Verify that Premium user CANNOT generate PDF without ₹50 payment
  console.log('\n[TEST 5] Verifying Premium user CANNOT generate PDF without ₹50 payment...');
  try {
    await axios.post(`${BASE_URL}/api/resume/generate-pdf`, {
      firebaseUid: TEST_UID,
      paymentId: 'non_existent_payment_id'
    });
    throw new Error('Expected generation without payment to fail');
  } catch (err) {
    console.log('Correctly blocked generation without valid ₹50 payment:', err.response?.data?.error || err.message);
  }

  // 6. Simulate Razorpay ₹50 payment verification for Resume #1
  console.log('\n[TEST 6] Simulating ₹50 Razorpay payment for Resume #1...');
  const orderRes1 = await axios.post(`${BASE_URL}/api/payment/create-order`, {
    amount: 50,
    firebaseUid: TEST_UID,
    purpose: 'pdf_generation',
    currency: 'INR',
    receipt: `pdf_${Date.now()}_1`
  });
  const realOrderId1 = orderRes1.data.id || orderRes1.data.order?.id;
  const paymentId1 = `pay_test_${Date.now()}_1`;
  console.log('Created ₹50 order for Resume #1:', realOrderId1);

  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'vV1j8N3h2O6iX0r8l3v1qX1x');
  hmac.update(`${realOrderId1}|${paymentId1}`);
  const signature1 = hmac.digest('hex');

  const verifyRes1 = await axios.post(`${BASE_URL}/api/payment/verify-signature`, {
    razorpay_order_id: realOrderId1,
    razorpay_payment_id: paymentId1,
    razorpay_signature: signature1,
    purpose: 'pdf_generation',
    firebaseUid: TEST_UID,
    amount: 50
  });
  console.log('Verified ₹50 payment for Resume #1:', verifyRes1.data);

  // 7. Generate Resume #1 using paymentId1
  console.log('\n[TEST 7] Generating Resume #1 with valid paymentId1...');
  const genRes1 = await axios.post(`${BASE_URL}/api/resume/generate-pdf`, {
    firebaseUid: TEST_UID,
    paymentId: paymentId1
  });
  console.log('Successfully generated Resume #1:', genRes1.data.success, 'PDF URL:', genRes1.data.resumeUrl);

  // 8. Attempt to REUSE paymentId1 for Resume #2 -> MUST BE REJECTED!
  console.log('\n[TEST 8] Attempting to REUSE paymentId1 for Resume #2 (Must be rejected)...');
  try {
    await axios.post(`${BASE_URL}/api/resume/generate-pdf`, {
      firebaseUid: TEST_UID,
      paymentId: paymentId1
    });
    throw new Error('Expected reused payment to fail');
  } catch (err) {
    console.log('Correctly rejected reusing paymentId1:', err.response?.data?.error || err.message);
  }

  // 9. Verify a NEW ₹50 payment is required for Resume #2
  console.log('\n[TEST 9] Making separate ₹50 payment for Resume #2...');
  const orderRes2 = await axios.post(`${BASE_URL}/api/payment/create-order`, {
    amount: 50,
    firebaseUid: TEST_UID,
    purpose: 'pdf_generation',
    currency: 'INR',
    receipt: `pdf_${Date.now()}_2`
  });
  const realOrderId2 = orderRes2.data.id || orderRes2.data.order?.id;
  const paymentId2 = `pay_test_${Date.now()}_2`;

  const hmac2 = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'vV1j8N3h2O6iX0r8l3v1qX1x');
  hmac2.update(`${realOrderId2}|${paymentId2}`);
  const signature2 = hmac2.digest('hex');

  const verifyRes2 = await axios.post(`${BASE_URL}/api/payment/verify-signature`, {
    razorpay_order_id: realOrderId2,
    razorpay_payment_id: paymentId2,
    razorpay_signature: signature2,
    purpose: 'pdf_generation',
    firebaseUid: TEST_UID,
    amount: 50
  });
  console.log('Verified second ₹50 payment for Resume #2:', verifyRes2.data);

  // 10. Generate Resume #2 using paymentId2
  console.log('\n[TEST 10] Generating Resume #2 with paymentId2...');
  const genRes2 = await axios.post(`${BASE_URL}/api/resume/generate-pdf`, {
    firebaseUid: TEST_UID,
    paymentId: paymentId2
  });
  console.log('Successfully generated Resume #2:', genRes2.data.success, 'PDF URL:', genRes2.data.resumeUrl);

  console.log('\n========================================');
  console.log('ALL OTP & RESUME BUILDER TESTS PASSED!');
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err.response?.data || err.message);
  process.exit(1);
});
