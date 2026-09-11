const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");

const { sendFastEmail } = require("../utils/mailer");

let otpStore = {};

router.post("/send", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
    });

    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    const subject = req.body.subject || "Resume Generation Verification OTP";
    const text = req.body.text || `Your OTP for Premium Resume Generation is ${otp}. This OTP is valid for 5 minutes.`;

    console.log(`\n========================================\n[OTP SERVICE] Generated OTP for ${email}: ${otp}\n========================================\n`);

    sendFastEmail({ to: email, subject, text });

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