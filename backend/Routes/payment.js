const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Resume = require("../Model/Resume");
const Subscription = require("../Model/Subscription");
const Application = require("../Model/Application");
const { isSubscriptionPaymentTimeAllowed, getFormattedIST } = require("../utils/timeHelper");
const { sendSubscriptionInvoiceEmail } = require("../utils/emailService");

// Initialize Razorpay Instance if credentials present
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret || key_id.includes("mock") || key_secret.includes("mock")) {
    return { key_id: null, key_secret: null, instance: null };
  }

  return {
    key_id,
    key_secret,
    instance: new Razorpay({
      key_id,
      key_secret,
    }),
  };
};

// POST /api/payment/create-order
// Accepts: { amount: 300 | 50, firebaseUid, purpose: "premium_membership" | "pdf_generation" }
router.post("/create-order", async (req, res) => {
  try {
    const { amount = 300, firebaseUid, purpose = "premium_membership", plan = "SILVER", userEmail = "" } = req.body;

    console.log("\n========================================");
    console.log("[PAYMENT DEBUG] CREATE ORDER REQUEST:");
    console.log("Firebase UID:", firebaseUid);
    console.log("Purpose:", purpose);
    console.log("Plan:", plan);
    console.log("Amount (INR):", amount);
    console.log("RAZORPAY_KEY_ID in env:", process.env.RAZORPAY_KEY_ID || "NOT SET (Using Dev Fallback)");
    console.log("========================================\n");

    if (!firebaseUid) {
      return res.status(400).json({ success: false, error: "Firebase UID is required" });
    }

    // Time window restriction for subscription payment: 10:00 AM to 11:00 AM IST
    if (purpose === "subscription") {
      if (!isSubscriptionPaymentTimeAllowed()) {
        console.warn("[PAYMENT ERROR] Subscription payment attempted outside 10:00 AM - 11:00 AM IST window.");
        return res.status(403).json({
          success: false,
          error: "Subscription payments are only allowed between 10:00 AM and 11:00 AM IST. Please try again during the allowed window.",
        });
      }
    }

    const { key_id, instance } = getRazorpayInstance();
    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${purpose}_${Date.now()}`,
      notes: {
        firebaseUid,
        purpose,
        plan: (plan || "SILVER").toUpperCase(),
        userEmail: userEmail || "",
      },
    };

    let order;
    let isMock = false;

    if (instance && key_id) {
      order = await instance.orders.create(options);
      console.log(`[PAYMENT DEBUG] Real Razorpay Order Created (${purpose}):`, order.id);
    } else {
      isMock = true;
      order = {
        id: `order_dev_${purpose}_${Date.now()}`,
        entity: "order",
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: "INR",
        receipt: options.receipt,
        status: "created",
        attempts: 0,
        notes: options.notes,
        created_at: Math.floor(Date.now() / 1000),
      };
      console.log(`[PAYMENT DEBUG] Created mock dev order for ${purpose}:`, order.id);
    }

    return res.status(200).json({
      success: true,
      keyId: key_id || "rzp_test_mock",
      isMock,
      order,
    });
  } catch (error) {
    console.error("[PAYMENT ERROR] Error creating Razorpay order:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create payment order" });
  }
});

// POST /api/payment/verify-signature
// Accepts: { razorpay_order_id, razorpay_payment_id, razorpay_signature, firebaseUid, purpose: "premium_membership" | "pdf_generation" }
router.post("/verify-signature", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      firebaseUid,
      purpose = "premium_membership",
      plan = "SILVER",
      amount = 300,
      userEmail = "",
      userName = "",
    } = req.body;

    console.log("\n========================================");
    console.log("[PAYMENT DEBUG] VERIFY SIGNATURE REQUEST:");
    console.log("Firebase UID:", firebaseUid);
    console.log("Purpose:", purpose);
    console.log("Plan:", plan);
    console.log("Order ID:", razorpay_order_id);
    console.log("Payment ID:", razorpay_payment_id);
    console.log("Received Signature:", razorpay_signature);
    console.log("========================================\n");

    if (!firebaseUid) {
      return res.status(400).json({ success: false, error: "Firebase UID is required" });
    }

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ success: false, error: "Order ID and Payment ID are required" });
    }

    // Enforce 10:00 AM - 11:00 AM IST window for subscription payments
    if (purpose === "subscription" || razorpay_order_id.includes("subscription")) {
      if (!isSubscriptionPaymentTimeAllowed()) {
        console.warn("[PAYMENT ERROR] Subscription signature verification outside 10:00 AM - 11:00 AM IST window.");
        return res.status(403).json({
          success: false,
          error: "Subscription payments are only allowed between 10:00 AM and 11:00 AM IST. Please try again during the allowed window.",
        });
      }
    }

    const { key_secret } = getRazorpayInstance();
    let isValid = false;
    let generatedSignature = "";

    if (key_secret && razorpay_signature && razorpay_signature !== "mock_test_signature") {
      generatedSignature = crypto
        .createHmac("sha256", key_secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      isValid = generatedSignature === razorpay_signature;

      console.log("[PAYMENT DEBUG] Signature Verification Check:");
      console.log("Generated Signature:", generatedSignature);
      console.log("Received Signature :", razorpay_signature);
      console.log("Signature Match    :", isValid);
    } else {
      isValid = true;
      console.log(`[PAYMENT DEBUG] Dev Mode: Auto-verifying test payment (${purpose}) for UID:`, firebaseUid);
    }

    if (!isValid) {
      console.error("[PAYMENT ERROR] Invalid Razorpay Signature!");
      return res.status(400).json({ success: false, error: "Invalid payment signature verification" });
    }

    // Handle Subscription Payment (Bronze ₹100, Silver ₹300, Gold ₹1000)
    if (purpose === "subscription" || razorpay_order_id.includes("subscription")) {
      const quotaMap = {
        FREE: 1,
        BRONZE: 3,
        SILVER: 5,
        GOLD: -1,
      };
      const cleanPlan = (plan || "SILVER").toUpperCase();
      const maxApplications = quotaMap[cleanPlan] !== undefined ? quotaMap[cleanPlan] : 5;
      const invoiceNumber = `INV-${Date.now()}`;
      const startDate = new Date();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days validity

      const subscriptionDoc = await Subscription.findOneAndUpdate(
        { firebaseUid },
        {
          $set: {
            firebaseUid,
            userEmail: userEmail || "",
            userName: userName || "",
            plan: cleanPlan,
            amount: Number(amount) || 0,
            maxApplications,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            invoiceNumber,
            startDate,
            endDate,
            status: "active",
          },
        },
        { new: true, upsert: true, runValidators: true }
      );

      console.log(`[PAYMENT DEBUG] Subscription record updated for ${cleanPlan}:`, subscriptionDoc._id);

      // Send invoice email asynchronously
      if (userEmail) {
        sendSubscriptionInvoiceEmail({
          toEmail: userEmail,
          userName: userName || userEmail,
          plan: cleanPlan,
          amount: Number(amount) || 0,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          invoiceNumber,
          maxApplications,
          validUntil: endDate,
        }).catch((err) => {
          console.error("[PAYMENT ERROR] Background invoice email failed:", err);
        });
      }

      return res.status(200).json({
        success: true,
        message: `${cleanPlan} subscription activated successfully`,
        data: subscriptionDoc,
        invoiceNumber,
      });
    }

    // Determine update payload based on payment purpose
    let updateQuery = {};
    if (purpose === "premium_membership" || razorpay_order_id.includes("premium")) {
      updateQuery = {
        $set: {
          isPremium: true,
          premiumPaymentId: razorpay_payment_id,
          premiumOrderId: razorpay_order_id,
          premiumPaymentDate: new Date(),
        },
      };
    } else {
      // PDF Generation Payment (₹50 per resume)
      const newPaymentRecord = {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: Number(amount) || 50,
        paymentDate: new Date(),
        isUsed: false,
      };

      updateQuery = {
        $set: {
          paymentStatus: true,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          paymentDate: new Date(),
        },
        $push: {
          pdfPayments: newPaymentRecord,
        },
      };
    }

    const updatedResume = await Resume.findOneAndUpdate(
      { firebaseUid },
      updateQuery,
      { new: true, upsert: true, runValidators: true }
    );

    console.log(`[PAYMENT DEBUG] MongoDB Resume (${purpose}) Updated Successfully:`, updateQuery);

    return res.status(200).json({
      success: true,
      message: `${purpose === "premium_membership" ? "Premium Membership" : "PDF Generation"} payment verified successfully`,
      paymentId: razorpay_payment_id,
      data: updatedResume,
    });
  } catch (error) {
    console.error("[PAYMENT ERROR] Exception verifying Razorpay signature:", error);
    return res.status(500).json({ success: false, error: error.message || "Payment verification failed" });
  }
});

// GET /api/payment/subscription/:firebaseUid - Fetch user subscription and monthly usage
router.get("/subscription/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { email } = req.query;

    const query = { $or: [{ firebaseUid }] };
    if (email) {
      query.$or.push({ userEmail: email });
    }

    const sub = await Subscription.findOne(query);

    // Calculate usage for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const appQuery = {
      $or: [
        { "user.uid": firebaseUid },
        { "user.email": email || "" },
        { firebaseUid },
      ],
      createdAt: { $gte: startOfMonth },
    };

    const monthlyApplicationsCount = await Application.countDocuments(appQuery);

    if (!sub) {
      return res.status(200).json({
        success: true,
        data: {
          plan: "FREE",
          amount: 0,
          maxApplications: 1,
          usedApplications: monthlyApplicationsCount,
          remainingApplications: Math.max(0, 1 - monthlyApplicationsCount),
          status: "active",
        },
      });
    }

    const remaining = sub.maxApplications === -1 ? -1 : Math.max(0, sub.maxApplications - monthlyApplicationsCount);

    return res.status(200).json({
      success: true,
      data: {
        plan: sub.plan,
        amount: sub.amount,
        maxApplications: sub.maxApplications,
        usedApplications: monthlyApplicationsCount,
        remainingApplications: remaining,
        invoiceNumber: sub.invoiceNumber,
        startDate: sub.startDate,
        endDate: sub.endDate,
        status: sub.status,
      },
    });
  } catch (error) {
    console.error("[PAYMENT ERROR] Error fetching subscription, returning default fallback:", error.message);
    return res.status(200).json({
      success: true,
      data: {
        plan: "FREE",
        amount: 0,
        maxApplications: 1,
        usedApplications: 0,
        remainingApplications: 1,
        status: "active",
      },
    });
  }
});

// POST /api/payment/subscribe-free - Select Free Plan (₹0)
router.post("/subscribe-free", async (req, res) => {
  try {
    const { firebaseUid, userEmail = "", userName = "" } = req.body;
    if (!firebaseUid) {
      return res.status(400).json({ success: false, error: "Firebase UID is required" });
    }

    try {
      const sub = await Subscription.findOneAndUpdate(
        { firebaseUid },
        {
          $set: {
            firebaseUid,
            userEmail,
            userName,
            plan: "FREE",
            amount: 0,
            maxApplications: 1,
            status: "active",
            startDate: new Date(),
          },
        },
        { new: true, upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: "Free plan selected successfully",
        data: sub,
      });
    } catch (dbErr) {
      console.warn("[PAYMENT WARN] DB offline, returning dev mock for free plan:", dbErr.message);
      return res.status(200).json({
        success: true,
        message: "Free plan selected successfully (Dev Mode)",
        data: {
          firebaseUid,
          userEmail,
          plan: "FREE",
          amount: 0,
          maxApplications: 1,
          status: "active",
        },
      });
    }
  } catch (error) {
    console.error("[PAYMENT ERROR] Error selecting free plan:", error);
    return res.status(500).json({ success: false, error: "Failed to select free plan" });
  }
});

module.exports = router;
