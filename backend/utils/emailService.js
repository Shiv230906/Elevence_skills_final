const nodemailer = require("nodemailer");
const { getFormattedIST } = require("./timeHelper");

/**
 * Sends a subscription invoice email to the subscriber
 */
async function sendSubscriptionInvoiceEmail({
  toEmail,
  userName = "Valued Member",
  plan = "FREE",
  amount = 0,
  paymentId = "N/A",
  orderId = "N/A",
  invoiceNumber = "",
  maxApplications = 1,
  validUntil = null,
}) {
  const invoiceRef = invoiceNumber || `INV-${Date.now()}`;
  const currentDateIST = getFormattedIST(new Date());
  const validityText = validUntil ? getFormattedIST(validUntil) : "1 Month from Purchase";
  const quotaText = maxApplications === -1 ? "Unlimited Applications" : `${maxApplications} Applications / month`;

  const emailSubject = `Subscription Invoice - ${plan} Plan [${invoiceRef}] | InternArea`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; }
          .content { padding: 28px 24px; color: #334155; }
          .invoice-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; }
          .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .table td { padding: 10px 6px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .table td.label { font-weight: 600; color: #64748b; width: 45%; }
          .table td.value { color: #0f172a; font-weight: 500; }
          .amount-row { background: #eff6ff; font-weight: bold; }
          .amount-row td { color: #1d4ed8 !important; font-size: 16px; padding: 12px 6px; border-bottom: none; }
          .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 9999px; font-weight: bold; font-size: 13px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Receipt & Invoice</h1>
            <p>Thank you for subscribing to InternArea!</p>
          </div>
          <div class="content">
            <p>Hello <strong>${userName || toEmail}</strong>,</p>
            <p>Your subscription payment has been processed successfully. Below are your official subscription invoice details:</p>

            <div class="invoice-box">
              <table class="table">
                <tr>
                  <td class="label">Invoice Reference:</td>
                  <td class="value"><strong>${invoiceRef}</strong></td>
                </tr>
                <tr>
                  <td class="label">Payment Date (IST):</td>
                  <td class="value">${currentDateIST}</td>
                </tr>
                <tr>
                  <td class="label">Selected Plan:</td>
                  <td class="value"><span class="badge">${plan}</span></td>
                </tr>
                <tr>
                  <td class="label">Application Limit:</td>
                  <td class="value">${quotaText}</td>
                </tr>
                <tr>
                  <td class="label">Payment Gateway ID:</td>
                  <td class="value" style="font-family: monospace; font-size: 13px;">${paymentId}</td>
                </tr>
                <tr>
                  <td class="label">Order Reference ID:</td>
                  <td class="value" style="font-family: monospace; font-size: 13px;">${orderId}</td>
                </tr>
                <tr>
                  <td class="label">Subscription Validity:</td>
                  <td class="value">${validityText}</td>
                </tr>
                <tr class="amount-row">
                  <td class="label">Total Amount Paid:</td>
                  <td class="value">₹${amount}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: #64748b;">
              You can now apply for internships according to your new subscription limits. Your quota refreshes monthly.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} InternArea. All rights reserved.</p>
            <p>This is an automated invoice confirmation sent to ${toEmail}.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
INVOICE - INTERNAREA SUBSCRIPTION
========================================
Invoice Reference: ${invoiceRef}
Date: ${currentDateIST}
Subscriber: ${userName || toEmail} (${toEmail})

Subscription Plan: ${plan}
Total Amount Paid: ₹${amount}
Application Quota: ${quotaText}
Payment ID: ${paymentId}
Order ID: ${orderId}
Validity: ${validityText}
========================================
Thank you for your business!
  `.trim();

  console.log(`\n========================================`);
  console.log(`[INVOICE EMAIL SERVICE] Generating Invoice for: ${toEmail}`);
  console.log(`Plan: ${plan} | Amount: ₹${amount} | Invoice: ${invoiceRef}`);
  console.log(`========================================\n`);

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const info = await transporter.sendMail({
        from: `"InternArea Subscriptions" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[INVOICE EMAIL SERVICE] Invoice sent successfully: ${info.messageId}`);
      return { success: true, messageId: info.messageId, invoiceRef };
    } catch (mailError) {
      console.error("[INVOICE EMAIL SERVICE] Nodemailer sending error:", mailError);
      return { success: false, error: mailError.message, invoiceRef };
    }
  } else {
    console.warn("[INVOICE EMAIL SERVICE] EMAIL_USER or EMAIL_PASS not set in .env. Email logged to console.");
    return { success: true, devMode: true, invoiceRef };
  }
}

module.exports = {
  sendSubscriptionInvoiceEmail,
};
