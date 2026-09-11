const mongoose = require("mongoose");

const PasswordResetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    targetEmail: {
      type: String,
      required: true,
    },
    targetPhone: {
      type: String,
      default: "",
    },
    otp: {
      type: String,
      required: true,
    },
    resetToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PasswordReset", PasswordResetSchema);
