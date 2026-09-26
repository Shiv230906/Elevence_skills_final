const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { sendFastEmail, sendOTPEmail } = require("../utils/mailer");

let otpStore = {};

// Generate a 6-digit numeric OTP using cryptographically secure random
function generateNumericOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}


router.post("/send", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const otp = generateNumericOtp();

    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    console.log(`\n========================================\n[OTP SERVICE] Generated OTP for ${email}: ${otp}\n========================================\n`);

    if (req.body.subject || req.body.text) {
      const subject = req.body.subject || "Resume Generation Verification OTP";
      const text = req.body.text || `Your OTP for Premium Resume Generation is ${otp}. This OTP is valid for 5 minutes.`;
      sendFastEmail({ to: email, subject, text });
    } else {
      sendOTPEmail(email, otp, "resume");
    }

    res.json({
      success: true,
      message: "OTP sent successfully",
      // Include otp in response if dev mode to make testing super easy
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error("OTP error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
});

router.post("/verify", (req, res) => {
  const { email, otp } = req.body;

  const stored = otpStore[email];

  if (!stored) {
    return res.status(400).json({
      success: false,
      message: "OTP not found or expired",
    });
  }

  if (Date.now() > stored.expiresAt) {
    delete otpStore[email];

    return res.status(400).json({
      success: false,
      message: "OTP expired",
    });
  }

  if (stored.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP",
    });
  }

  delete otpStore[email];

  res.json({
    success: true,
    message: "OTP verified successfully",
  });
});

module.exports = router;