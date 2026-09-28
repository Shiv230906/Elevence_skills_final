const nodemailer = require("nodemailer");

/**
 * mailer.js — Transactional Email Delivery via Nodemailer + Gmail SMTP
 *
 * Uses Gmail SMTP with STARTTLS on port 587, forced to IPv4 (family: 4).
 * Render's default DNS resolution can return an IPv6 address for smtp.gmail.com
 * which causes ENETUNREACH on port 587. Setting family: 4 pins the TCP socket
 * to IPv4 and avoids that failure.
 *
 * All credentials are read from environment variables — never hardcoded.
 *
 * Required environment variables (set in Render dashboard or .env):
 *   SMTP_HOST   — smtp.gmail.com
 *   SMTP_PORT   — 587
 *   SMTP_SECURE — false  (STARTTLS; use true only for port 465)
 *   SMTP_USER   — your Gmail address
 *   SMTP_PASS   — your Gmail App Password (16-char, no spaces)
 *   SMTP_FROM   — sender address shown to recipient (same as SMTP_USER)
 *
 * Credentials are NEVER logged or exposed to clients.
 */

let _transporter = null;

/**
 * Returns a cached Nodemailer transporter, or null if SMTP env vars are missing.
 */
function getTransporter() {
  if (_transporter) return _transporter;

  const host = (process.env.SMTP_HOST || "").trim();
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = (process.env.SMTP_SECURE || "false").trim().toLowerCase() === "true";
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();

  // Guard: require all critical SMTP env vars to be set and non-placeholder
  if (!host || !user || !pass || pass === "your_gmail_app_password_here") {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,          // false = STARTTLS (upgrades plain → TLS after EHLO on port 587)
    family: 4,       // Force IPv4 — prevents ENETUNREACH on Render where DNS may resolve
                     // smtp.gmail.com to an IPv6 address that is unreachable on port 587
    auth: {
      user,
      pass,          // Gmail App Password — never logged
    },
    // Cloud-safe timeouts — prevents indefinite hangs on Render
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return _transporter;
}

/**
 * Runs transporter.verify() at server startup and logs a clear READY / FAILED
 * message to Render logs so connectivity problems are visible immediately,
 * without needing to trigger a real email send.
 *
 * Call this once from index.js after the server starts.
 * Never throws — failures are logged and swallowed so they don't crash the server.
 */
async function verifyTransporter() {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(
      "[SMTP VERIFY] Skipped — SMTP credentials are not configured (dev mode)."
    );
    return;
  }

  console.log(
    "[SMTP VERIFY] Testing SMTP connection to " +
    (process.env.SMTP_HOST || "smtp.gmail.com") + ":" +
    (process.env.SMTP_PORT || "587") + " (IPv4 forced)..."
  );

  try {
    await transporter.verify();
    console.log(
      "[SMTP VERIFY] ✅ SMTP connection READY — Gmail SMTP is reachable and credentials are accepted."
    );
  } catch (err) {
    // Log the diagnostic error but NEVER log SMTP_PASS
    console.error(
      "[SMTP VERIFY] ❌ SMTP connection FAILED: " + err.message
    );
    console.error(
      "[SMTP VERIFY] Check: (1) SMTP_USER / SMTP_PASS are correct on Render, " +
      "(2) Gmail App Password is enabled (not your regular Gmail password), " +
      "(3) Render allows outbound TCP on port 587."
    );
    // Reset cached transporter so the next send attempt rebuilds it
    _transporter = null;
  }
}

/**
 * Returns the "From" address for outgoing mail.
 * Uses SMTP_FROM if set, falls back to SMTP_USER.
 */
function getSenderAddress() {
  const fromEnv = (process.env.SMTP_FROM || "").trim();
  const userEnv = (process.env.SMTP_USER || "").trim();
  const address = fromEnv || userEnv || "noreply@internarea.com";
  return `"InternArea" <${address}>`;
}

/**
 * Core email dispatcher using Nodemailer + Gmail SMTP.
 * Falls back to dev-mode console logging when SMTP vars are not configured.
 *
 * @param {{ to: string, subject: string, text?: string, html?: string }} options
 * @returns {Promise<{ success: boolean, messageId?: string, devMode?: boolean, error?: string }>}
 */
async function sendFastEmail({ to, subject, text, html }) {
  const cleanRecipient = typeof to === "string" ? to.trim() : to;

  console.log("\n========================================");
  console.log("[SMTP EMAIL] Dispatching email to: " + cleanRecipient);
  console.log("[SMTP EMAIL] Subject: " + subject);
  console.log("[SMTP EMAIL] Snippet: " + (text ? text.slice(0, 80) : "HTML content") + "...");
  console.log("========================================\n");

  const transporter = getTransporter();

  if (!transporter) {
    // Dev mode: SMTP not configured — log to console so development still works
    console.warn(
      "[SMTP EMAIL] SMTP credentials are not fully configured. Email logged to console (dev mode).\n" +
      "[SMTP EMAIL] To enable real delivery, set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM."
    );
    console.log("[SMTP EMAIL DEV] Would have sent to:", cleanRecipient);
    console.log("[SMTP EMAIL DEV] Subject:", subject);
    console.log("[SMTP EMAIL DEV] Body (text):\n", text || "(HTML only)");
    return { success: true, devMode: true };
  }

  try {
    const info = await transporter.sendMail({
      from: getSenderAddress(),
      to: cleanRecipient,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    });

    console.log(
      "[SMTP EMAIL] Delivered successfully to " + cleanRecipient + " (Message ID: " + info.messageId + ")"
    );
    return { success: true, messageId: info.messageId };
  } catch (err) {
    // Log a useful error message — NEVER log SMTP_PASS or auth credentials
    console.error(
      "[SMTP EMAIL] Delivery FAILED to " + cleanRecipient + ": " + err.message
    );
    // Return a safe, non-sensitive error to the caller — never expose SMTP creds
    return { success: false, error: "Email delivery failed. Check server logs." };
  }
}

/**
 * Standardized OTP email delivery interface.
 * Preserves the sendOTPEmail(email, otp, purpose) signature for full backward compatibility.
 *
 * The email contains:
 * - InternArea branding
 * - 6-digit OTP prominently displayed
 * - Expiration message (5 or 10 minutes depending on purpose)
 * - Security warning not to share the OTP
 *
 * @param {string} email       - Recipient email address
 * @param {string} otp         - 6-digit numeric OTP code
 * @param {string} [purpose]   - "login" | "password_reset" | "resume"
 * @returns {Promise<{ success: boolean, messageId?: string, devMode?: boolean, error?: string }>}
 */
function sendOTPEmail(email, otp, purpose = "login") {
  let title = "Two-Step Login Verification";
  let actionDesc = "log in to your InternArea account";
  let expiryMinutes = 5;

  if (purpose === "password_reset") {
    title = "Password Reset Verification";
    actionDesc = "reset your InternArea account password";
    expiryMinutes = 10;
  } else if (purpose === "resume") {
    title = "Resume Generation Verification";
    actionDesc = "generate your professional resume";
    expiryMinutes = 5;
  }

  const subject = `${otp} is your verification code — InternArea`;

  const text = [
    `InternArea — ${title}`,
    "=".repeat(40),
    `Your verification code is: ${otp}`,
    "",
    `You are attempting to ${actionDesc}.`,
    `This OTP is valid for ${expiryMinutes} minutes.`,
    "",
    "SECURITY NOTICE:",
    "Never share this verification code with anyone. InternArea representatives will never ask for your OTP.",
    "If you did not initiate this request, please secure your account immediately.",
    "=".repeat(40),
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">InternArea</h1>
            <p style="color: #bfdbfe; margin: 6px 0 0 0; font-size: 13px;">Security &amp; Account Protection</p>
          </div>

          <!-- Body -->
          <div style="padding: 28px 24px;">
            <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 12px 0;">${title}</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
              Use the 6-digit verification code below to ${actionDesc}:
            </p>

            <!-- OTP Box -->
            <div style="background: #eff6ff; border: 1.5px dashed #3b82f6; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: 'Courier New', Courier, monospace; display: inline-block;">
                ${otp}
              </span>
            </div>

            <!-- Expiration & Security -->
            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 4px; margin-bottom: 20px;">
              <p style="color: #92400e; font-size: 13px; line-height: 1.4; margin: 0;">
                ⏱ <strong>Expires in ${expiryMinutes} minutes.</strong> Do not share this code with anyone.
              </p>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
              If you did not attempt this action, please ignore this email or update your password immediately to protect your account.
            </p>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center; background-color: #f8fafc;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} InternArea. All rights reserved.
            </p>
            <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0;">
              Automated message sent to ${email}. Do not reply.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendFastEmail({ to: email, subject, text, html });
}

module.exports = {
  sendFastEmail,
  sendOTPEmail,
  sendLoginOtpEmail: sendOTPEmail, // backward-compat alias
  getTransporter,                  // exposes transporter for diagnostics/testing
  verifyTransporter,               // call once at startup for a clear SMTP connectivity log
};
