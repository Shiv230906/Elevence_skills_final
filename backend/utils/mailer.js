const { Resend } = require("resend");

/**
 * mailer.js — Email delivery via Resend HTTPS API
 *
 * Replaces direct Gmail SMTP / Nodemailer delivery.
 * Render blocks outbound SMTP connections on ports 25, 465, and 587 on its
 * hosting platform, causing "connect ETIMEDOUT ... :465".
 * Resend sends via standard HTTPS (port 443), which is never blocked on Render,
 * Vercel, or any other cloud environment.
 *
 * Required environment variable:
 *   RESEND_API_KEY — Your Resend API key (https://resend.com/api-keys)
 *
 * Optional environment variable:
 *   RESEND_FROM_EMAIL — Verified sender (e.g., "InternArea <noreply@yourdomain.com>")
 *                       Defaults to "InternArea <onboarding@resend.dev>" for testing.
 */

let resendClient = null;

function getResendClient() {
  if (resendClient) return resendClient;

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  // Ensure non-empty and not a placeholder
  if (!apiKey || apiKey === "re_your_api_key_here" || apiKey.startsWith("re_your_")) {
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Returns the configured sender address.
 * Uses RESEND_FROM_EMAIL if set, otherwise falls back to Resend's onboarding sandbox address.
 */
function getFromAddress() {
  return (
    process.env.RESEND_FROM_EMAIL ||
    "InternArea <onboarding@resend.dev>"
  );
}

/**
 * Fast, reliable email dispatcher using the Resend HTTPS API.
 * Never blocks the main thread with slow TCP socket handshakes.
 *
 * @param {{ to: string, subject: string, text?: string, html?: string }} options
 * @returns {Promise<{ success: boolean, messageId?: string, devMode?: boolean, error?: string }>}
 */
function sendFastEmail({ to, subject, text, html }) {
  const cleanRecipient = typeof to === "string" ? to.trim() : to;

  console.log("\n========================================");
  console.log("[EMAIL SERVICE] Dispatching email to: " + cleanRecipient);
  console.log("[EMAIL SERVICE] Subject: " + subject);
  console.log("[EMAIL SERVICE] Snippet: " + (text ? text.slice(0, 80) : "HTML content") + "...");
  console.log("========================================\n");

  const client = getResendClient();

  if (!client) {
    console.warn(
      "[EMAIL SERVICE] RESEND_API_KEY is not configured or is placeholder. Email logged to console (dev mode)."
    );
    return Promise.resolve({ success: true, devMode: true });
  }

  const from = getFromAddress();

  return client.emails
    .send({
      from,
      to: cleanRecipient,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    })
    .then((response) => {
      if (response.error) {
        // Resend returned an API error (e.g. invalid key, unverified domain, etc.)
        console.error(
          "[EMAIL SERVICE] Resend API error delivering to " + cleanRecipient + ":",
          response.error.message || response.error
        );
        return { success: false, error: response.error.message || "Email delivery failed" };
      }

      const messageId = response.data && response.data.id;
      console.log(
        "[EMAIL SERVICE] Delivered successfully to " + cleanRecipient + " (Resend ID: " + messageId + ")"
      );
      return { success: true, messageId };
    })
    .catch((err) => {
      console.error(
        "[EMAIL SERVICE] Delivery request failed to " + cleanRecipient + ":",
        err.message
      );
      return { success: false, error: "Network error during email dispatch" };
    });
}

/**
 * Standardized OTP email delivery interface.
 * Exposes sendOTPEmail(email, otp, purpose) preserving full backward compatibility.
 *
 * Contains:
 * - 6-digit OTP code prominently displayed
 * - Purpose / login verification context
 * - Expiration time (5 minutes)
 * - Security warning message
 *
 * @param {string} email - Recipient email address
 * @param {string} otp - 6-digit numeric OTP code
 * @param {string} [purpose="login"] - Context of the verification ("login", "password_reset", "resume")
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
  sendLoginOtpEmail: sendOTPEmail,
  // Stub for backward compatibility
  getTransporter: function () {
    return null;
  },
};
