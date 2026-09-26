const { BrevoClient } = require("@getbrevo/brevo");

/**
 * mailer.js — Transactional Email Delivery via Brevo API
 *
 * Replaces direct SMTP and Resend delivery.
 * Brevo sends emails over HTTPS API (port 443), eliminating any port 465/587
 * timeout issues on Render.
 *
 * Unlike Resend (which restricts unverified domains to account-owner-only in testing),
 * Brevo allows sending to any recipient once your sender email is verified in Brevo.
 *
 * Required environment variables:
 *   BREVO_API_KEY      — Brevo v3 API key (e.g., xkeysib-...) from Brevo Dashboard -> SMTP & API
 *   BREVO_SENDER_EMAIL — Sender email address verified in your Brevo account (e.g., your verified email)
 *
 * Optional environment variables:
 *   BREVO_SENDER_NAME  — Sender name (defaults to "InternArea")
 */

let brevoClient = null;

function getBrevoClient() {
  if (brevoClient) return brevoClient;

  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  // Ensure non-empty and not a dummy placeholder
  if (!apiKey || apiKey === "your_brevo_api_key_here" || apiKey.startsWith("your_")) {
    return null;
  }

  brevoClient = new BrevoClient({ apiKey });
  return brevoClient;
}

/**
 * Returns the configured Brevo sender object { name, email }.
 */
function getSender() {
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || "").trim();
  const senderName = (process.env.BREVO_SENDER_NAME || "InternArea").trim();

  return {
    email: senderEmail || "noreply@internarea.com",
    name: senderName || "InternArea",
  };
}

/**
 * Fast, reliable email dispatcher using Brevo's HTTPS Transactional Email API.
 * Never blocks the main thread with slow TCP socket handshakes.
 *
 * @param {{ to: string, subject: string, text?: string, html?: string }} options
 * @returns {Promise<{ success: boolean, messageId?: string, devMode?: boolean, error?: string }>}
 */
async function sendFastEmail({ to, subject, text, html }) {
  const cleanRecipient = typeof to === "string" ? to.trim() : to;

  console.log("\n========================================");
  console.log("[BREVO EMAIL SERVICE] Dispatching email to: " + cleanRecipient);
  console.log("[BREVO EMAIL SERVICE] Subject: " + subject);
  console.log("[BREVO EMAIL SERVICE] Snippet: " + (text ? text.slice(0, 80) : "HTML content") + "...");
  console.log("========================================\n");

  const client = getBrevoClient();

  if (!client) {
    console.warn(
      "[BREVO EMAIL SERVICE] BREVO_API_KEY is not configured or is placeholder. Email logged to console (dev mode)."
    );
    return { success: true, devMode: true };
  }

  const sender = getSender();

  if (!process.env.BREVO_SENDER_EMAIL) {
    console.warn(
      "[BREVO EMAIL SERVICE] Warning: BREVO_SENDER_EMAIL is not set. Using default sender: " + sender.email
    );
  }

  try {
    const response = await client.transactionalEmails.sendTransacEmail({
      sender: {
        name: sender.name,
        email: sender.email,
      },
      to: [
        {
          email: cleanRecipient,
        },
      ],
      subject,
      ...(html ? { htmlContent: html } : {}),
      ...(text ? { textContent: text } : {}),
    });

    const messageId = response?.messageId || (response?.messageIds && response.messageIds[0]) || "brevo-sent";
    console.log(
      "[BREVO EMAIL SERVICE] Delivered successfully to " + cleanRecipient + " (Message ID: " + messageId + ")"
    );
    return { success: true, messageId };
  } catch (err) {
    const errorDetails = err?.body?.message || err?.message || "Brevo delivery error";
    console.error(
      "[BREVO EMAIL SERVICE] Delivery failed to " + cleanRecipient + ":",
      errorDetails
    );
    // Never expose API keys or internal stack trace to the caller
    return { success: false, error: "Email delivery failed" };
  }
}

/**
 * Standardized OTP email delivery interface.
 * Exposes sendOTPEmail(email, otp, purpose) preserving full backward compatibility.
 *
 * Contains:
 * - 6-digit OTP code prominently displayed
 * - Expiration time (5 minutes)
 * - Two-Step Login Verification message
 * - InternArea branding
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
