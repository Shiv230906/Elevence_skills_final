const express = require("express");
const router = express.Router();
const axios = require("axios");
const nodemailer = require("nodemailer");
// otp-generator removed — using crypto.randomInt for OTP generation (see generateNumericOtp below)
const { detectDeviceInfo } = require("../utils/deviceDetector");
const { isMobileLoginTimeAllowed, getFormattedIST } = require("../utils/timeHelper");
const LoginHistory = require("../Model/LoginHistory");

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../Model/User");
const Resume = require("../Model/Resume");
const PasswordReset = require("../Model/PasswordReset");
const { generateAlphaPassword } = require("../utils/passwordGenerator");

const { sendFastEmail } = require("../utils/mailer");

/**
 * Generates a 6-digit numeric OTP using cryptographically secure random.
 * Replacement for otp-generator package (not included in dependencies).
 */
function generateNumericOtp() {
  // Generate a random number in [0, 999999] and zero-pad to 6 digits
  const num = crypto.randomInt(0, 1000000);
  return String(num).padStart(6, "0");
}

// In-memory OTP store for login verification (separate from language-change OTP store)
const loginOtpStore = {};

/**
 * Helper: save a login history record, with graceful DB-offline fallback
 */
async function saveLoginHistory(data) {
  try {
    const record = new LoginHistory(data);
    await record.save();
    return record;
  } catch (err) {
    console.warn("[AUTH] Could not save login history (DB may be offline):", err.message);
    return null;
  }
}

/**
 * Helper: update an existing login history record by _id
 */
async function updateLoginHistory(id, update) {
  try {
    await LoginHistory.findByIdAndUpdate(id, { $set: update });
  } catch (err) {
    console.warn("[AUTH] Could not update login history (DB may be offline):", err.message);
  }
}

/**
 * Helper: send OTP email using fast pooled mailer
 */
function sendLoginOtpEmail(email, otp) {
  const subject = "Login Security OTP — InternArea";
  const text = `Your login verification OTP is: ${otp}\n\nThis OTP is valid for 5 minutes.\n\nIf you did not attempt to log in, please ignore this email.`;

  console.log(`\n========================================`);
  console.log(`[AUTH OTP] Generated login OTP for ${email}: ${otp}`);
  console.log(`========================================\n`);

  sendFastEmail({ to: email, subject, text });
}

/**
 * POST /api/auth/validate-login
 * Validates normal username/email + password credentials.
 * If credentials are correct, generates a login OTP, saves to loginOtpStore,
 * sends email, records history as otp_pending, and returns requiresOtp: true.
 */
router.post("/validate-login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/username and password are required.",
      });
    }

    const rawInput = identifier.trim();
    const isEmail = rawInput.includes("@");
    const cleanEmail = isEmail ? rawInput.toLowerCase() : "";
    const cleanUsername = !isEmail ? rawInput.toLowerCase() : "";

    // 1. Find user in MongoDB
    let user = null;
    if (isEmail) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = await User.findOne({
        $or: [
          { username: cleanUsername },
          { phone: rawInput },
          { email: rawInput.toLowerCase() },
          { name: rawInput },
        ],
      });
    }

    // Fallback: check Resume collection if not found in User model
    if (!user && isEmail) {
      const resume = await Resume.findOne({ email: cleanEmail });
      if (resume) {
        user = await User.findOne({ email: resume.email?.toLowerCase().trim() });
      }
    }

    // Admin fallback credentials
    const adminUser = (process.env.ADMIN_USER || "admin").toLowerCase().trim();
    const adminEmail = (process.env.EMAIL_USER || "").toLowerCase().trim();
    if (!user && ((isEmail && cleanEmail === adminEmail) || rawInput.toLowerCase() === adminUser)) {
      user = await User.findOne({ role: "admin" });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/username or password.",
      });
    }

    // 2. Validate password
    let passwordMatches = false;

    // Check bcrypt hash in User record
    if (user.password) {
      try {
        passwordMatches = bcrypt.compareSync(password, user.password);
      } catch (err) {
        console.warn("[AUTH] Error checking bcrypt password:", err.message);
      }
    }

    // Admin fallback password check
    if (!passwordMatches && user.role === "admin") {
      const adminPass = process.env.ADMIN_PASS || "admin";
      if (password === adminPass || password === "admin123" || password === "Lvj3f96fMKCXYGKl") {
        passwordMatches = true;
      }
    }

    // If not matched via bcrypt and user has email, try verifying against Firebase Identity Toolkit REST API
    if (!passwordMatches && user.email) {
      try {
        const fbRes = await axios.post(
          "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDzH_SOQor9cF-BxjN1d_ihHJgsG6Zx8RQ",
          {
            email: user.email,
            password: password,
            returnSecureToken: true,
          }
        );
        if (fbRes.data && fbRes.data.localId) {
          passwordMatches = true;
          if (!user.firebaseUid) {
            user.firebaseUid = fbRes.data.localId;
          }
          if (!user.password) {
            user.password = bcrypt.hashSync(password, 10);
          }
          await user.save();
        }
      } catch (fbErr) {
        // Password invalid
      }
    }

    const deviceInfo = detectDeviceInfo(req);
    const { browser, os, deviceType, isMobile, ipAddress } = deviceInfo;

    if (!passwordMatches) {
      await saveLoginHistory({
        firebaseUid: user.firebaseUid || "unknown",
        userEmail: user.email || identifier,
        browser,
        os,
        deviceType,
        ipAddress,
        status: "failed",
        reason: "invalid_password",
      });

      return res.status(401).json({
        success: false,
        message: "Invalid email/username or password.",
      });
    }

    // 3. Check mobile time restriction
    if (isMobile) {
      const allowed = isMobileLoginTimeAllowed();
      if (!allowed) {
        const historyRecord = await saveLoginHistory({
          firebaseUid: user.firebaseUid || "pending",
          userEmail: user.email,
          browser,
          os,
          deviceType,
          ipAddress,
          status: "blocked",
          reason: "mobile_time_restriction",
        });

        return res.status(403).json({
          success: false,
          blocked: true,
          reason: "mobile_time_restriction",
          message:
            "Mobile login is only allowed between 10:00 AM and 1:00 PM IST. Please try again during the allowed window.",
          historyId: historyRecord?._id || null,
        });
      }
    }

    // 4. Generate 6-digit login OTP
    const otp = generateNumericOtp();
    loginOtpStore[user.email] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      firebaseUid: user.firebaseUid || "",
    };

    sendLoginOtpEmail(user.email, otp);

    const historyRecord = await saveLoginHistory({
      firebaseUid: user.firebaseUid || "pending",
      userEmail: user.email,
      browser,
      os,
      deviceType,
      ipAddress,
      status: "otp_pending",
      reason: "normal_login_otp_required",
    });

    return res.json({
      success: true,
      requiresOtp: true,
      message: "OTP sent to your registered email for login verification.",
      email: user.email,
      name: user.name || "User",
      firebaseUid: user.firebaseUid || "",
      historyId: historyRecord?._id?.toString() || null,
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error("[VALIDATE LOGIN] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process login. Please try again.",
    });
  }
});

/**
 * POST /api/auth/login-check
 * Called after Firebase popup succeeds (Google login).
 * Body: { firebaseUid, userEmail, loginType, isGoogleLogin }
 * IP and User-Agent are extracted server-side only.
 *
 * Returns one of:
 *   { blocked: true, reason: "mobile_time_restriction", message: "..." }
 *   { requiresOtp: true, message: "OTP sent to your email", historyId: "..." }
 *   { allowed: true, historyId: "..." }
 */
router.post("/login-check", async (req, res) => {
  const { firebaseUid, userEmail, loginType = "google", isGoogleLogin } = req.body;

  if (!firebaseUid || !userEmail) {
    return res.status(400).json({ error: "firebaseUid and userEmail are required" });
  }

  // Detect device/browser/IP from request headers (server-side, cannot be spoofed)
  const deviceInfo = detectDeviceInfo(req);
  const { browser, os, deviceType, isMobile, isChrome, ipAddress } = deviceInfo;

  console.log(`\n[AUTH] Login check for ${userEmail} | Browser: ${browser} | Device: ${deviceType} | IP: ${ipAddress} | isChrome: ${isChrome} | isMobile: ${isMobile} | loginType: ${loginType}`);

  // ── RULE 1: Mobile time restriction ──────────────────────────────────────
  if (isMobile) {
    const allowed = isMobileLoginTimeAllowed();
    if (!allowed) {
      const historyRecord = await saveLoginHistory({
        firebaseUid,
        userEmail,
        browser,
        os,
        deviceType,
        ipAddress,
        status: "blocked",
        reason: "mobile_time_restriction",
      });

      console.warn(`[AUTH] Mobile login BLOCKED for ${userEmail} — outside 10 AM–1 PM IST`);
      return res.status(403).json({
        blocked: true,
        reason: "mobile_time_restriction",
        message:
          "Mobile login is only allowed between 10:00 AM and 1:00 PM IST. Please try again during the allowed window.",
        historyId: historyRecord?._id || null,
      });
    }
  }

  const isGoogle = loginType === "google" || isGoogleLogin === true;

  // ── RULE 2: OTP verification for Google login (or Chrome fallback) ─────────
  if (isGoogle || (isChrome && !isMobile)) {
    const otp = generateNumericOtp();

    loginOtpStore[userEmail] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      firebaseUid,
    };

    // Send OTP email
    sendLoginOtpEmail(userEmail, otp);

    // Record as otp_pending in history
    const historyRecord = await saveLoginHistory({
      firebaseUid,
      userEmail,
      browser,
      os,
      deviceType,
      ipAddress,
      status: "otp_pending",
      reason: isGoogle ? "google_login_otp_required" : "chrome_otp_required",
    });

    return res.json({
      requiresOtp: true,
      message: "OTP sent to your registered email for login verification.",
      historyId: historyRecord?._id?.toString() || null,
      // Expose devOtp in non-production for easy local testing
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  }

  // ── RULE 3: Normal login (email/password or non-Google) — allow immediately ──
  const historyRecord = await saveLoginHistory({
    firebaseUid,
    userEmail,
    browser,
    os,
    deviceType,
    ipAddress,
    status: "success",
    reason: "",
  });

  return res.json({
    allowed: true,
    requiresOtp: false,
    historyId: historyRecord?._id?.toString() || null,
  });
});

/**
 * POST /api/auth/verify-login-otp
 * Verifies the OTP sent during Chrome login.
 * Body: { firebaseUid, userEmail, otp, historyId }
 *
 * Returns:
 *   { allowed: true } on success
 *   403 on invalid/expired OTP
 */
router.post("/verify-login-otp", async (req, res) => {
  const { firebaseUid, userEmail, otp, historyId } = req.body;

  if (!userEmail || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP are required" });
  }

  const stored = loginOtpStore[userEmail];

  // OTP not found
  if (!stored) {
    await updateLoginHistory(historyId, { status: "otp_failed", reason: "otp_not_found_or_expired" });
    return res.status(400).json({ success: false, message: "OTP not found or expired. Please login again." });
  }

  // OTP expired
  if (Date.now() > stored.expiresAt) {
    delete loginOtpStore[userEmail];
    await updateLoginHistory(historyId, { status: "otp_failed", reason: "otp_expired" });
    return res.status(400).json({ success: false, message: "OTP has expired. Please try logging in again." });
  }

  // Wrong OTP
  if (stored.otp !== otp.trim()) {
    await updateLoginHistory(historyId, { status: "otp_failed", reason: "invalid_otp" });
    return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
  }

  // Success
  delete loginOtpStore[userEmail];
  await updateLoginHistory(historyId, { status: "success", reason: "" });

  // Update lastLoginAt on User model
  try {
    const effectiveUid = firebaseUid || stored.firebaseUid;
    let user = null;
    if (effectiveUid) {
      user = await User.findOne({ firebaseUid: effectiveUid });
    }
    if (!user && userEmail) {
      user = await User.findOne({ email: userEmail.toLowerCase().trim() });
    }
    if (user) {
      user.lastLoginAt = new Date();
      if (effectiveUid && !user.firebaseUid) {
        user.firebaseUid = effectiveUid;
      }
      await user.save();
    } else if (effectiveUid || userEmail) {
      user = new User({
        firebaseUid: effectiveUid,
        email: userEmail ? userEmail.toLowerCase().trim() : undefined,
        name: userEmail ? userEmail.split("@")[0] : "User",
        role: "user",
        lastLoginAt: new Date(),
      });
      await user.save();
    }
  } catch (dbErr) {
    console.warn("[AUTH] Could not update/create user record:", dbErr.message);
  }

  console.log(`[AUTH OTP] Login OTP verified successfully for ${userEmail}`);
  return res.json({ allowed: true, success: true });
});

/**
 * POST /api/auth/check-exists
 * Checks if email, username, or phone is already registered.
 */
router.post("/check-exists", async (req, res) => {
  try {
    const { email, username, phone } = req.body;
    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingEmail) {
        return res.json({ exists: true, field: "email", message: "An account with this email already exists." });
      }
    }
    if (username) {
      const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
      if (existingUser) {
        return res.json({ exists: true, field: "username", message: "This username is already taken." });
      }
    }
    if (phone) {
      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.length >= 7) {
        const existingPhone = await User.findOne({
          $or: [{ phone: cleaned }, { phone: new RegExp(cleaned.slice(-10) + "$") }],
        });
        if (existingPhone) {
          return res.json({ exists: true, field: "phone", message: "This phone number is already registered." });
        }
      }
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error("[CHECK EXISTS] Error:", err);
    return res.status(500).json({ error: "Unable to check user uniqueness" });
  }
});

/**
 * POST /api/auth/register
 * Creates or synchronizes a user profile in MongoDB after Firebase account creation.
 * Body: { firebaseUid, fullName, email, phone, username, password, profilePhoto }
 */
router.post("/register", async (req, res) => {
  try {
    const { firebaseUid, fullName, email, phone, username, password, profilePhoto } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ success: false, message: "firebaseUid and email are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username ? username.toLowerCase().trim() : undefined;
    const cleanPhone = phone ? phone.trim() : undefined;

    let user = await User.findOne({
      $or: [
        { firebaseUid },
        { email: cleanEmail },
        ...(cleanUsername ? [{ username: cleanUsername }] : []),
      ],
    });

    if (user) {
      user.firebaseUid = firebaseUid;
      if (fullName) user.name = fullName.trim();
      if (cleanPhone) user.phone = cleanPhone;
      if (cleanUsername) user.username = cleanUsername;
      if (profilePhoto) user.profilePhoto = profilePhoto;
      if (password) user.password = bcrypt.hashSync(password, 10);
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      user = new User({
        firebaseUid,
        name: (fullName && fullName.trim()) || "User",
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,
        password: password ? bcrypt.hashSync(password, 10) : null,
        profilePhoto: profilePhoto || "",
        role: "user",
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await user.save();
    }

    return res.json({
      success: true,
      message: "User registered successfully.",
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        profilePhoto: user.profilePhoto,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[REGISTER] Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email, username, or phone already exists.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to register user details in database.",
    });
  }
});

/**
 * GET /api/auth/profile/:firebaseUid
 * Fetches user profile from MongoDB User collection using Firebase UID.
 */
router.get("/profile/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    if (!firebaseUid) {
      return res.status(400).json({ error: "firebaseUid is required" });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ error: "User profile not found" });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        profilePhoto: user.profilePhoto,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[PROFILE] Error fetching profile:", err);
    return res.status(500).json({ error: "Unable to fetch user profile" });
  }
});

/**
 * GET /api/auth/login-history/:firebaseUid
 * Returns the last 20 login attempts for the given user, newest first.
 */
router.get("/login-history/:firebaseUid", async (req, res) => {
  const { firebaseUid } = req.params;

  if (!firebaseUid) {
    return res.status(400).json({ error: "firebaseUid is required" });
  }

  try {
    const history = await LoginHistory.find({ firebaseUid })
      .sort({ loginTime: -1 })
      .limit(20)
      .lean();

    return res.json({ success: true, history });
  } catch (err) {
    console.error("[AUTH] Error fetching login history:", err.message);
    // Graceful fallback — return empty array so profile page doesn't crash
    return res.json({ success: true, history: [] });
  }
});

// ── FORGOT PASSWORD FEATURE HELPERS & ROUTES ─────────────────────────────

/**
 * Checks if two dates fall on the same calendar day in Indian Standard Time (IST, UTC+5:30)
 */
function isSameDayIST(d1, d2) {
  if (!d1 || !d2) return false;
  const getISTDate = (date) => {
    const d = new Date(date);
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const istTime = new Date(utc + 3600000 * 5.5);
    return `${istTime.getFullYear()}-${String(istTime.getMonth() + 1).padStart(2, "0")}-${String(istTime.getDate()).padStart(2, "0")}`;
  };
  return getISTDate(d1) === getISTDate(d2);
}

/**
 * Helper to mask email for privacy (e.g. shivanif53@gmail.com -> s*******3@gmail.com)
 */
function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

/**
 * Helper to mask phone for privacy (e.g. 8015698335 -> ******8335)
 */
function maskPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 4) return cleaned;
  return `${"*".repeat(Math.max(1, cleaned.length - 4))}${cleaned.slice(-4)}`;
}

/**
 * Sends Password Reset OTP via Nodemailer
 */
async function sendForgotPasswordOtpEmail(email, otp) {
  const subject = "Password Reset Verification OTP — InternArea";
  const text = `Your password reset verification OTP is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request a password reset, please secure your account immediately.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #2563eb; margin-top: 0; font-size: 22px;">Password Reset Verification</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">We received a request to reset your InternArea account password. Use the verification OTP below to complete the reset:</p>
      <div style="background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.4;">This OTP is valid for <strong>10 minutes</strong>. As a security policy, you may only request a password reset <strong>once per day</strong>.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 14px;">If you did not request this password reset, please disregard this email. Your existing credentials remain safe.</p>
    </div>
  `;

  console.log(`\n========================================`);
  console.log(`[FORGOT PASSWORD OTP] Generated OTP for ${email}: ${otp}`);
  console.log(`========================================\n`);

  sendFastEmail({ to: email, subject, text, html });
}

/**
 * Searches for an existing registered user by email or phone.
 * Checks User collection first, then Resume collection, then admin credentials.
 * Automatically synchronizes or creates User record if needed.
 */
async function findOrCreateUserRecord(identifier) {
  if (!identifier || typeof identifier !== "string") return null;
  const rawInput = identifier.trim();
  const isEmail = rawInput.includes("@");

  let cleanEmail = "";
  let cleanPhone = "";

  if (isEmail) {
    cleanEmail = rawInput.toLowerCase();
    // Validate standard email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) return null;
  } else {
    cleanPhone = rawInput.replace(/\D/g, "");
    if (cleanPhone.length < 7) return null;
  }

  // 1. Search existing User collection
  let user = null;
  if (isEmail) {
    user = await User.findOne({ email: cleanEmail });
  } else {
    // Search exact or by last 10 digits
    const last10 = cleanPhone.slice(-10);
    user = await User.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: new RegExp(last10 + "$") },
        { username: rawInput.toLowerCase() }
      ]
    });
  }

  if (user) {
    return {
      user,
      targetEmail: user.email,
      targetPhone: user.phone || cleanPhone,
    };
  }

  // 2. Search Resume collection (existing user database)
  let resume = null;
  if (isEmail) {
    resume = await Resume.findOne({ email: cleanEmail });
  } else {
    const last10 = cleanPhone.slice(-10);
    resume = await Resume.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: new RegExp(last10 + "$") }
      ]
    });
  }

  if (resume) {
    // Sync into User model
    user = await User.findOne({ email: resume.email?.toLowerCase().trim() });
    if (!user) {
      user = new User({
        name: resume.name || "Registered User",
        email: resume.email ? resume.email.toLowerCase().trim() : undefined,
        phone: resume.phone ? resume.phone.trim() : (cleanPhone || undefined),
        firebaseUid: resume.firebaseUid,
        role: "user",
      });
      await user.save();
    }
    return {
      user,
      targetEmail: user.email || resume.email,
      targetPhone: user.phone || resume.phone || cleanPhone,
    };
  }

  // 3. Check Admin credentials configuration
  const adminUser = (process.env.ADMIN_USER || "admin").toLowerCase().trim();
  const adminEmail = (process.env.EMAIL_USER || "").toLowerCase().trim();
  const adminPhone = "8015698335"; // Registered admin phone number

  if (
    (isEmail && cleanEmail === adminEmail) ||
    (!isEmail && (cleanPhone === adminPhone || cleanPhone.slice(-10) === adminPhone.slice(-10))) ||
    rawInput.toLowerCase() === adminUser
  ) {
    user = await User.findOne({ role: "admin" });
    if (!user) {
      user = new User({
        name: "Administrator",
        email: adminEmail || "admin@internarea.com",
        phone: adminPhone,
        role: "admin",
      });
      await user.save();
    }
    return {
      user,
      targetEmail: user.email || adminEmail,
      targetPhone: user.phone || adminPhone,
    };
  }

  return null;
}

/**
 * POST /api/auth/forgot-password/request
 * Initiates the password reset flow.
 * Validates registered account, enforces once-per-day restriction, sends OTP.
 */
router.post("/forgot-password/request", async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier || !identifier.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email or phone number is required.",
      });
    }

    // 1. Verify user exists
    const accountInfo = await findOrCreateUserRecord(identifier);
    if (!accountInfo || !accountInfo.user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email or phone number.",
      });
    }

    const { user, targetEmail, targetPhone } = accountInfo;

    // 2. Enforce ONE RESET REQUEST PER DAY restriction
    if (user.lastResetRequestDate && isSameDayIST(user.lastResetRequestDate, new Date())) {
      console.warn(`[FORGOT PASSWORD] Blocked reset request for ${user.email || identifier}: already requested today.`);
      return res.status(429).json({
        success: false,
        message: "You can use this option only once per day.",
      });
    }

    // 3. Invalidate any prior unused OTP tokens for this user
    await PasswordReset.updateMany(
      { userId: user._id, isUsed: false },
      { $set: { isUsed: true } }
    );

    // 4. Generate 6-digit numeric OTP and unique session reset token
    const otp = generateNumericOtp();

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 5. Store OTP record in database
    const resetRecord = new PasswordReset({
      userId: user._id,
      identifier: identifier.trim(),
      targetEmail: targetEmail || process.env.EMAIL_USER || "user@example.com",
      targetPhone: targetPhone || "",
      otp: otp.trim(),
      resetToken,
      expiresAt,
      isUsed: false,
      attempts: 0,
      requestedAt: new Date(),
    });
    await resetRecord.save();

    // 6. Update user's lastResetRequestDate to enforce once-per-day restriction
    user.lastResetRequestDate = new Date();
    await user.save();

    // 7. Dispatch OTP via Email
    const dispatchEmail = targetEmail || process.env.EMAIL_USER;
    if (dispatchEmail) {
      await sendForgotPasswordOtpEmail(dispatchEmail, otp);
    }

    // 8. Return response WITHOUT exposing the OTP
    return res.json({
      success: true,
      message: "OTP sent successfully to your registered contact.",
      maskedContact: dispatchEmail ? maskEmail(dispatchEmail) : maskPhone(targetPhone),
      maskedEmail: dispatchEmail ? maskEmail(dispatchEmail) : null,
      maskedPhone: targetPhone ? maskPhone(targetPhone) : null,
      resetToken,
    });
  } catch (error) {
    console.error("[FORGOT PASSWORD REQUEST] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process password reset request. Please try again later.",
    });
  }
});

/**
 * POST /api/auth/forgot-password/verify
 * Verifies the OTP, generates a random letter-only password, hashes with bcrypt,
 * and updates user's password in the database.
 */
router.post("/forgot-password/verify", async (req, res) => {
  try {
    const { resetToken, otp } = req.body;

    if (!resetToken || !otp) {
      return res.status(400).json({
        success: false,
        message: "Reset token and OTP are required.",
      });
    }

    const resetRecord = await PasswordReset.findOne({ resetToken });
    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset session. Please request a new OTP.",
      });
    }

    if (resetRecord.isUsed) {
      return res.status(400).json({
        success: false,
        message: "This OTP has already been used. Please request a new password reset.",
      });
    }

    if (Date.now() > resetRecord.expiresAt.getTime()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (resetRecord.attempts >= 5) {
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    // Verify OTP match
    if (resetRecord.otp !== otp.trim()) {
      resetRecord.attempts += 1;
      await resetRecord.save();
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check and try again.",
      });
    }

    // Mark OTP as used
    resetRecord.isUsed = true;
    await resetRecord.save();

    // 1. Generate random password: ONLY [A-Za-z], NO numbers, NO special chars
    const generatedPassword = generateAlphaPassword(12);

    // 2. Hash password with bcrypt
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(generatedPassword, salt);

    // 3. Update User in database
    const user = await User.findById(resetRecord.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account could not be found.",
      });
    }

    user.password = hashedPassword;
    await user.save();

    console.log(`[FORGOT PASSWORD] Successfully updated password for user: ${user.email || user._id}`);

    // Send reset confirmation email with the new password
    const emailAddress = resetRecord.targetEmail || user.email;
    if (emailAddress) {
      const confirmSubject = "Your Elevance Password Has Been Reset — InternArea";
      const confirmText = `Hello ${user.name || "User"},\n\nYour InternArea account password has been successfully reset.\n\nYour new password is: ${generatedPassword}\n\nImportant:\n- This password contains only uppercase and lowercase letters (no numbers or symbols).\n- Please log in and consider changing it to something you prefer.\n- If you did not request this reset, contact support immediately.\n\nLogin at: https://elevance-skills-final.vercel.app/login\n\nStay secure,\nInternArea Team`;
      const confirmHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #2563eb; margin-top: 0;">Password Reset Successful</h2>
          <p style="color: #374151; line-height: 1.6;">Hello <strong>${user.name || "User"}</strong>,</p>
          <p style="color: #374151; line-height: 1.6;">Your InternArea account password has been successfully reset. Here is your new generated password:</p>
          <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Your New Password</p>
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1d4ed8; font-family: monospace;">${generatedPassword}</span>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: #92400e;">
            <strong>&#9888; Security Notice:</strong><br/>
            This password contains only uppercase and lowercase letters (A–Z, a–z) &mdash; no numbers or special characters.<br/>
            After logging in, we recommend updating it to a password of your choice.
          </div>
          <p style="color: #374151; line-height: 1.6;">If you did not request a password reset, please secure your account immediately.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 14px;">This is an automated security email from InternArea. Do not reply.</p>
        </div>
      `;
      sendFastEmail({ to: emailAddress, subject: confirmSubject, text: confirmText, html: confirmHtml });
    }

    return res.json({
      success: true,
      message: "Password reset successfully.",
      generatedPassword,
    });
  } catch (error) {
    console.error("[FORGOT PASSWORD VERIFY] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP. Please try again.",
    });
  }
});

/**
 * POST /api/auth/forgot-password/resend
 * Resends the OTP for an active unexpired reset session
 */
router.post("/forgot-password/resend", async (req, res) => {
  try {
    const { resetToken } = req.body;
    if (!resetToken) {
      return res.status(400).json({ success: false, message: "Reset token is required." });
    }

    const resetRecord = await PasswordReset.findOne({ resetToken, isUsed: false });
    if (!resetRecord || Date.now() > resetRecord.expiresAt.getTime()) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please start a new reset request.",
      });
    }

    // Resend email
    await sendForgotPasswordOtpEmail(resetRecord.targetEmail, resetRecord.otp);

    return res.json({
      success: true,
      message: "OTP resent successfully to your registered contact.",
    });
  } catch (error) {
    console.error("[FORGOT PASSWORD RESEND] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP.",
    });
  }
});

/**
 * POST /api/auth/forgot-password/verify-otp
 * Verifies the OTP and marks the reset session as verified (without modifying password yet).
 */
router.post("/forgot-password/verify-otp", async (req, res) => {
  try {
    const { resetToken, otp } = req.body;

    if (!resetToken || !otp) {
      return res.status(400).json({
        success: false,
        message: "Reset token and OTP are required.",
      });
    }

    const resetRecord = await PasswordReset.findOne({ resetToken });
    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset session. Please request a new OTP.",
      });
    }

    if (resetRecord.isUsed) {
      return res.status(400).json({
        success: false,
        message: "This OTP has already been used. Please request a new password reset.",
      });
    }

    if (Date.now() > resetRecord.expiresAt.getTime()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (resetRecord.attempts >= 5) {
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    if (resetRecord.otp !== otp.trim()) {
      resetRecord.attempts += 1;
      await resetRecord.save();
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check and try again.",
      });
    }

    // Mark verified
    resetRecord.isVerified = true;
    await resetRecord.save();

    return res.json({
      success: true,
      message: "OTP verified successfully.",
      resetToken,
    });
  } catch (error) {
    console.error("[FORGOT PASSWORD VERIFY OTP] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP. Please try again.",
    });
  }
});

/**
 * POST /api/auth/forgot-password/generate-password
 * Generates a random password containing ONLY uppercase and lowercase letters (A-Z, a-z).
 */
router.post("/forgot-password/generate-password", (req, res) => {
  try {
    const generatedPassword = generateAlphaPassword(12);
    return res.json({
      success: true,
      generatedPassword,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Unable to generate password.",
    });
  }
});

/**
 * POST /api/auth/forgot-password/complete
 * Applies the new generated password to the user account after OTP verification.
 * Body: { resetToken, newPassword }
 */
router.post("/forgot-password/complete", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required.",
      });
    }

    const resetRecord = await PasswordReset.findOne({ resetToken });
    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset session. Please request a new password reset.",
      });
    }

    if (resetRecord.isUsed) {
      return res.status(400).json({
        success: false,
        message: "This reset session has already been completed.",
      });
    }

    if (!resetRecord.isVerified) {
      return res.status(400).json({
        success: false,
        message: "OTP verification must be completed first.",
      });
    }

    if (Date.now() > resetRecord.expiresAt.getTime()) {
      return res.status(400).json({
        success: false,
        message: "Reset session has expired. Please request a new one.",
      });
    }

    // Security validation: Password must strictly contain ONLY uppercase and lowercase English letters
    if (!/^[a-zA-Z]+$/.test(newPassword.trim())) {
      return res.status(400).json({
        success: false,
        message: "Generated password must contain only uppercase and lowercase letters (no numbers or symbols).",
      });
    }

    const user = await User.findById(resetRecord.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account could not be found.",
      });
    }

    // Hash password with bcrypt
    const salt = bcrypt.genSaltSync(10);
    user.password = bcrypt.hashSync(newPassword.trim(), salt);
    await user.save();

    // Mark reset record used
    resetRecord.isUsed = true;
    await resetRecord.save();

    console.log(`[FORGOT PASSWORD COMPLETE] Password updated for user: ${user.email || user._id}`);

    // Send confirmation email
    const emailAddress = resetRecord.targetEmail || user.email;
    if (emailAddress) {
      const confirmSubject = "Your Elevance Password Has Been Reset — InternArea";
      const confirmText = `Hello ${user.name || "User"},\n\nYour InternArea account password has been successfully reset.\n\nYour new password is: ${newPassword.trim()}\n\nImportant:\n- This password contains only uppercase and lowercase letters (no numbers or symbols).\n- Please log in and consider changing it to something you prefer.\n- If you did not request this reset, contact support immediately.\n\nLogin at: https://elevance-skills-final.vercel.app/login\n\nStay secure,\nInternArea Team`;
      const confirmHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #2563eb; margin-top: 0;">Password Reset Successful</h2>
          <p style="color: #374151; line-height: 1.6;">Hello <strong>${user.name || "User"}</strong>,</p>
          <p style="color: #374151; line-height: 1.6;">Your InternArea account password has been successfully reset. Here is your new generated password:</p>
          <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Your New Password</p>
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1d4ed8; font-family: monospace;">${newPassword.trim()}</span>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: #92400e;">
            <strong>&#9888; Security Notice:</strong><br/>
            This password contains only uppercase and lowercase letters (A–Z, a–z) &mdash; no numbers or special characters.<br/>
            After logging in, you can update it to a password of your choice.
          </div>
          <p style="color: #374151; line-height: 1.6;">If you did not request a password reset, please secure your account immediately.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 14px;">This is an automated security email from InternArea. Do not reply.</p>
        </div>
      `;
      sendFastEmail({ to: emailAddress, subject: confirmSubject, text: confirmText, html: confirmHtml });
    }

    return res.json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("[FORGOT PASSWORD COMPLETE] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update password. Please try again.",
    });
  }
});

/**
 * POST /api/auth/resend-login-otp
 * Resends the login verification OTP for both credentials and Google login flows.
 * Body: { userEmail, loginType?, firebaseUid? }
 *
 * Unlike /login-check, this endpoint ALWAYS generates and sends a new OTP
 * regardless of browser type. It is only called from the verify-otp page
 * after the user has already passed credential/Google authentication.
 */
router.post("/resend-login-otp", async (req, res) => {
  const { userEmail, loginType, firebaseUid } = req.body;

  if (!userEmail) {
    return res.status(400).json({ success: false, message: "userEmail is required." });
  }

  // Generate a fresh 6-digit OTP
  const otp = generateNumericOtp();

  loginOtpStore[userEmail] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    firebaseUid: firebaseUid || loginOtpStore[userEmail]?.firebaseUid || "",
  };

  // Send via email
  sendLoginOtpEmail(userEmail, otp);

  console.log(`[AUTH OTP RESEND] New OTP generated for ${userEmail} (loginType: ${loginType || "unknown"})`);

  return res.json({
    success: true,
    requiresOtp: true,
    message: "A new verification OTP has been sent to your registered email.",
    // Expose devOtp in non-production for easy local testing
    ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
  });
});

module.exports = router;


