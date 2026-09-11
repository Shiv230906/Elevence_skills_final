const nodemailer = require("nodemailer");

/**
 * Shared singleton transporter with connection pooling and fast timeouts
 */
let transporterInstance = null;

function getTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporterInstance = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 6000,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return transporterInstance;
}

/**
 * Fast, non-blocking email sender.
 * Logs immediately to the console for testing/debugging and dispatches
 * the email in the background without holding up the HTTP response.
 */
function sendFastEmail({ to, subject, text, html }) {
  console.log(`\n========================================`);
  console.log(`[EMAIL SERVICE] Dispatching email to: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Content snippet: ${text ? text.slice(0, 80) : "HTML content"}...`);
  console.log(`========================================\n`);

  const transporter = getTransporter();

  if (!transporter) {
    console.warn("[EMAIL SERVICE] EMAIL_USER or EMAIL_PASS not set. Email logged to console.");
    return Promise.resolve({ devMode: true });
  }

  return new Promise((resolve) => {
    transporter
      .sendMail({
        from: `"InternArea" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html,
      })
      .then((info) => {
        console.log(`[EMAIL SERVICE] Delivered successfully to ${to} (ID: ${info.messageId})`);
        resolve({ success: true, messageId: info.messageId });
      })
      .catch((err) => {
        console.error(`[EMAIL SERVICE] Delivery failed to ${to}:`, err.message);
        resolve({ success: false, error: err.message });
      });
  });
}

module.exports = {
  getTransporter,
  sendFastEmail,
};
