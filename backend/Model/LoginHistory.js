const mongoose = require("mongoose");

/**
 * LoginHistory Schema
 * Records every login attempt with device/browser/IP metadata and security outcome.
 */
const LoginHistorySchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      default: "",
      index: true,
    },
    browser: {
      type: String,
      default: "Unknown Browser",
    },
    os: {
      type: String,
      default: "Unknown OS",
    },
    deviceType: {
      type: String,
      enum: ["Desktop", "Mobile", "Tablet"],
      default: "Desktop",
    },
    ipAddress: {
      type: String,
      default: "Unknown",
    },
    loginTime: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["success", "failed", "blocked", "otp_pending", "otp_failed"],
      default: "success",
    },
    reason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("LoginHistory", LoginHistorySchema);
