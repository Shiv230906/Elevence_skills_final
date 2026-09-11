const mongoose = require("mongoose");

const FriendSchema = new mongoose.Schema(
  {
    requester: {
      type: String,
      required: true,
    },
    receiver: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate friend requests
FriendSchema.index({ requester: 1, receiver: 1 }, { unique: true });

module.exports = mongoose.model("Friend", FriendSchema);
