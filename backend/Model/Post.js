const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      default: "",
    },
    userPhoto: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      required: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

const PostSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      default: "",
    },
    userPhoto: {
      type: String,
      default: "",
    },
    userEmail: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      enum: ["image", "video", null],
      default: null,
    },
    // Array of Firebase UIDs who liked this post
    likes: {
      type: [String],
      default: [],
    },
    comments: {
      type: [CommentSchema],
      default: [],
    },
    shares: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient feed queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Post", PostSchema);
