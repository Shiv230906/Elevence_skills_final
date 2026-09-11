const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: "",
    },
    plan: {
      type: String,
      enum: ["FREE", "BRONZE", "SILVER", "GOLD"],
      default: "FREE",
    },
    amount: {
      type: Number,
      default: 0,
    },
    maxApplications: {
      type: Number, // 1 for FREE, 3 for BRONZE, 5 for SILVER, -1 for GOLD (unlimited)
      default: 1,
    },
    paymentId: {
      type: String,
      default: "",
    },
    orderId: {
      type: String,
      default: "",
    },
    invoiceNumber: {
      type: String,
      default: "",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Subscription", SubscriptionSchema);
