/**
 * mailer.js — Transactional Email Delivery via Brevo HTTP REST API (Port 443)
 *
 * Replaces Nodemailer + Gmail SMTP which is blocked on Render Free tier
 * (outbound TCP on ports 25, 465, 587 is dropped). All requests now go to
 *   https://api.brevo.com/v3/smtp/email
 * over HTTPS (port 443), which Render allows without restriction.
 *
 * Required environment variables (set in Render dashboard and local .env):
 *   BREVO_API_KEY      — your Brevo account API key (starts with xkeysib-)
 *   BREVO_SENDER_EMAIL — verified sender address in your Brevo account
 *                        (falls back to SMTP_FROM, then SMTP_USER for compat)
 *
 * All credentials are NEVER logged or exposed to clients.
 *
 * Exported interface (unchanged — full backward compatibility):
 *   sendFastEmail({ to, subject, text?, html? })  -> Promise
 *   sendOTPEmail(email, otp, purpose?)             -> Promise
 *   verifyTransporter()                            -> Promise<void>
 *   getTransporter()                               -> null (stub for compat)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSenderEmail() {
  return (
    (process.env.BREVO_SENDER_EMAIL || '').trim() ||
    (process.env.SMTP_FROM || '').trim() ||
    (process.env.SMTP_USER || '').trim() ||
    'noreply@internarea.com'
  );
}

function getBrevoApiKey() {
  const key = (process.env.BREVO_API_KEY || '').trim();
  if (!key || key === 'your_brevo_api_key_here') return null;
  return key;
}

// ---------------------------------------------------------------------------
// Core HTTP dispatcher
// ---------------------------------------------------------------------------

async function sendFastEmail({ to, subject, text, html }) {
  const cleanRecipient = typeof to === 'string' ? to.trim() : to;

  console.log('\n========================================');
  console.log('[BREVO EMAIL] Dispatching email to: ' + cleanRecipient);
  console.log('[BREVO EMAIL] Subject: ' + subject);
  console.log('[BREVO EMAIL] Snippet: ' + (text ? text.slice(0, 80) : 'HTML content') + '...');
  console.log('========================================\n');

  const apiKey = getBrevoApiKey();

  if (!apiKey) {
    console.warn(
      '[BREVO EMAIL] BREVO_API_KEY is not configured. Email logged to console (dev mode).\n' +
      '[BREVO EMAIL] To enable real delivery, set BREVO_API_KEY and BREVO_SENDER_EMAIL in Render.'
    );
    console.log('[BREVO EMAIL DEV] Would have sent to:', cleanRecipient);
    console.log('[BREVO EMAIL DEV] Subject:', subject);
    console.log('[BREVO EMAIL DEV] Body (text):\n', text || '(HTML only)');
    return { success: true, devMode: true };
  }

  const senderEmail = getSenderEmail();

  const payload = {
    sender: { name: 'InternArea', email: senderEmail },
    to: [{ email: cleanRecipient }],
    subject,
    ...(text ? { textContent: text } : {}),
    ...(html ? { htmlContent: html } : {}),
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
      console.error(
        '[BREVO EMAIL] Delivery FAILED to ' + cleanRecipient +
        ' - HTTP ' + response.status + ': ' + JSON.stringify(data)
      );
      return { success: false, error: 'Email delivery failed (HTTP ' + response.status + '). Check server logs.' };
    }

    const messageId = data.messageId || data.MessageId || '(no-id)';
    console.log(
      '[BREVO EMAIL] Delivered successfully to ' + cleanRecipient +
      ' (Message ID: ' + messageId + ')'
    );
    return { success: true, messageId };

  } catch (err) {
    console.error('[BREVO EMAIL] Network error dispatching to ' + cleanRecipient + ': ' + err.message);
    return { success: false, error: 'Email delivery failed (network error). Check server logs.' };
  }
}

// ---------------------------------------------------------------------------
// Startup connectivity probe (replaces transporter.verify())
// ---------------------------------------------------------------------------

async function verifyTransporter() {
  const apiKey = getBrevoApiKey();

  if (!apiKey) {
    console.warn(
      '[BREVO VERIFY] Skipped - BREVO_API_KEY is not configured (dev mode). ' +
      'Set BREVO_API_KEY in Render dashboard to enable live email delivery.'
    );
    return;
  }

  console.log('[BREVO VERIFY] Probing Brevo API connectivity (HTTPS port 443)...');

  try {
    const response = await fetch('https://api.brevo.com/v3/account', {
      method: 'GET',
      headers: { 'accept': 'application/json', 'api-key': apiKey },
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const planName = data && data.plan && data.plan[0] ? data.plan[0].type : 'unknown';
      console.log(
        '[BREVO VERIFY] Brevo API READY - connected successfully. ' +
        'Account: ' + (data.email || 'verified') + ' | Plan: ' + planName
      );
    } else {
      const errData = await response.json().catch(() => ({}));
      console.error('[BREVO VERIFY] Brevo API HTTP ' + response.status + ': ' + JSON.stringify(errData));
      console.error(
        '[BREVO VERIFY] Check: (1) BREVO_API_KEY correct in Render env vars, ' +
        '(2) Key has Transactional emails permission, ' +
        '(3) Sender email verified in Brevo.'
      );
    }
  } catch (err) {
    console.error('[BREVO VERIFY] Brevo API connectivity FAILED: ' + err.message);
    console.error('[BREVO VERIFY] Check outbound HTTPS (port 443) access from Render.');
  }
}

// ---------------------------------------------------------------------------
// OTP email - preserves sendOTPEmail(email, otp, purpose) signature exactly
// ---------------------------------------------------------------------------

function sendOTPEmail(email, otp, purpose) {
  if (purpose === undefined) purpose = 'login';

  let title = 'Two-Step Login Verification';
  let actionDesc = 'log in to your InternArea account';
  let expiryMinutes = 5;

  if (purpose === 'password_reset') {
    title = 'Password Reset Verification';
    actionDesc = 'reset your InternArea account password';
    expiryMinutes = 10;
  } else if (purpose === 'resume') {
    title = 'Resume Generation Verification';
    actionDesc = 'generate your professional resume';
    expiryMinutes = 5;
  }

  const subject = otp + ' is your verification code - InternArea';

  const text = [
    'InternArea - ' + title,
    '='.repeat(40),
    'Your verification code is: ' + otp,
    '',
    'You are attempting to ' + actionDesc + '.',
    'This OTP is valid for ' + expiryMinutes + ' minutes.',
    '',
    'SECURITY NOTICE:',
    'Never share this verification code with anyone. InternArea representatives will never ask for your OTP.',
    'If you did not initiate this request, please secure your account immediately.',
    '='.repeat(40),
  ].join('\n');

  const year = new Date().getFullYear();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title}</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;margin:0;padding:24px;color:#1e293b;"><div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05);"><div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">InternArea</h1><p style="color:#bfdbfe;margin:6px 0 0 0;font-size:13px;">Security &amp; Account Protection</p></div><div style="padding:28px 24px;"><h2 style="color:#0f172a;font-size:18px;margin:0 0 12px 0;">${title}</h2><p style="color:#475569;font-size:14px;line-height:1.5;margin:0 0 20px 0;">Use the 6-digit verification code below to ${actionDesc}:</p><div style="background:#eff6ff;border:1.5px dashed #3b82f6;border-radius:10px;padding:20px;text-align:center;margin:24px 0;"><span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1d4ed8;font-family:'Courier New',Courier,monospace;display:inline-block;">${otp}</span></div><div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 14px;border-radius:4px;margin-bottom:20px;"><p style="color:#92400e;font-size:13px;line-height:1.4;margin:0;">&#9201; <strong>Expires in ${expiryMinutes} minutes.</strong> Do not share this code with anyone.</p></div><p style="color:#64748b;font-size:13px;line-height:1.5;margin:0;">If you did not attempt this action, please ignore this email or update your password immediately.</p></div><div style="border-top:1px solid #f1f5f9;padding:16px 24px;text-align:center;background-color:#f8fafc;"><p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${year} InternArea. All rights reserved.</p><p style="color:#94a3b8;font-size:11px;margin:4px 0 0 0;">Automated message sent to ${email}. Do not reply.</p></div></div></body></html>`;

  return sendFastEmail({ to: email, subject, text, html });
}

// ---------------------------------------------------------------------------
// Stub - kept for backward compatibility with any importers of getTransporter
// ---------------------------------------------------------------------------
function getTransporter() {
  return null;
}

// ---------------------------------------------------------------------------
// Exports - interface identical to previous mailer.js
// ---------------------------------------------------------------------------
module.exports = {
  sendFastEmail,
  sendOTPEmail,
  sendLoginOtpEmail: sendOTPEmail, // backward-compat alias used in auth.js
  getTransporter,                  // stub - not needed with HTTP transport
  verifyTransporter,               // call once at startup for connectivity probe
};
