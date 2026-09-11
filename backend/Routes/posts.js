const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const Post = require("../Model/Post");
const Friend = require("../Model/Friend");
const { getDailyPostLimit } = require("../config/communityConfig");

// ── Cloudinary Configuration ──────────────────────────────────────────────────
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ── Multer Setup (local temp storage) ────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "../uploads/media");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed: JPEG, PNG, WEBP, GIF, MP4, WebM`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// ── Helper: Upload to Cloudinary or Serve Locally ────────────────────────────
async function uploadMedia(localPath, filename, mimeType, req) {
  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);
  const resourceType = isVideo ? "video" : "image";

  // Try Cloudinary if configured
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    try {
      const result = await cloudinary.uploader.upload(localPath, {
        resource_type: resourceType,
        folder: "posts",
        public_id: `post_${Date.now()}`,
      });
      // Clean up temp file
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return { url: result.secure_url, source: "cloudinary" };
    } catch (err) {
      console.error("[POSTS] Cloudinary upload failed, using local fallback:", err.message);
    }
  }

  // Local fallback — file already saved by multer
  const host = req.get("host") || "localhost:5000";
  const protocol = req.protocol || "http";
  return { url: `${protocol}://${host}/media/${filename}`, source: "local" };
}

// ── Helper: Get accepted friend count ────────────────────────────────────────
async function getAcceptedFriendCount(userId) {
  return Friend.countDocuments({
    $or: [{ requester: userId }, { receiver: userId }],
    status: "accepted",
  });
}

// ── Helper: Get today's post count for a user ─────────────────────────────────
async function getTodayPostCount(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return Post.countDocuments({
    userId,
    createdAt: { $gte: today, $lt: tomorrow },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/posts/permission/:userId
 * Check posting permission for a user — returns limit info
 */
router.get("/permission/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const friendCount = await getAcceptedFriendCount(userId);
    const dailyLimit = getDailyPostLimit(friendCount);
    const todayCount = await getTodayPostCount(userId);

    const unlimited = dailyLimit === Infinity;
    const canPost = unlimited ? true : todayCount < dailyLimit;
    const remaining = unlimited ? Infinity : Math.max(0, dailyLimit - todayCount);

    return res.json({
      success: true,
      friendCount,
      dailyLimit: unlimited ? "unlimited" : dailyLimit,
      todayCount,
      canPost,
      remaining: unlimited ? "unlimited" : remaining,
      unlimited,
    });
  } catch (error) {
    console.error("[POSTS] Error checking permission:", error);
    return res.status(500).json({ error: "Unable to check posting permission" });
  }
});

/**
 * GET /api/posts
 * Get all posts (newest first), paginated
 * Query: ?page=1&limit=20&userId=xxx (userId filters to that user's posts)
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const { userId } = req.query;

    const query = userId ? { userId } : {};

    const [posts, total] = await Promise.all([
      Post.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Post.countDocuments(query),
    ]);

    return res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[POSTS] Error fetching posts:", error);
    return res.status(500).json({ error: "Unable to fetch posts" });
  }
});

/**
 * POST /api/posts
 * Create a new post (enforces daily limit server-side)
 * Body: multipart/form-data — { userId, userName, userPhoto, userEmail, content, media? }
 */
router.post("/", upload.single("media"), async (req, res) => {
  try {
    const { userId, userName, userPhoto, userEmail, content } = req.body;

    if (!userId) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "userId is required" });
    }

    if (!content?.trim() && !req.file) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Post must have text content or media" });
    }

    // ── Server-side posting limit check ──────────────────────────────────────
    const friendCount = await getAcceptedFriendCount(userId);
    const dailyLimit = getDailyPostLimit(friendCount);

    if (dailyLimit === 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        error: "You need at least one friend to create a post",
        code: "NO_FRIENDS",
      });
    }

    if (dailyLimit !== Infinity) {
      const todayCount = await getTodayPostCount(userId);
      if (todayCount >= dailyLimit) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({
          error: "You have reached your daily posting limit",
          code: "LIMIT_REACHED",
          dailyLimit,
          todayCount,
        });
      }
    }

    // ── Media Upload ──────────────────────────────────────────────────────────
    let mediaUrl = null;
    let mediaType = null;

    if (req.file) {
      const isVideo = ALLOWED_VIDEO_TYPES.includes(req.file.mimetype);
      mediaType = isVideo ? "video" : "image";

      const { url } = await uploadMedia(req.file.path, req.file.filename, req.file.mimetype, req);
      mediaUrl = url;
    }

    // ── Create Post ───────────────────────────────────────────────────────────
    const post = new Post({
      userId,
      userName: userName || "Anonymous",
      userPhoto: userPhoto || "",
      userEmail: userEmail || "",
      content: content?.trim() || "",
      mediaUrl,
      mediaType,
    });

    await post.save();

    return res.status(201).json({ success: true, post });
  } catch (error) {
    console.error("[POSTS] Error creating post:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    if (error.message?.includes("File type not allowed")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File is too large. Maximum size is 50 MB." });
    }
    return res.status(500).json({ error: "Unable to create post" });
  }
});

/**
 * GET /api/posts/:id
 * Get a single post by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).lean();

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    return res.json({ success: true, post });
  } catch (error) {
    console.error("[POSTS] Error fetching post:", error);
    return res.status(500).json({ error: "Unable to fetch post" });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete a post — only the owner can delete
 * Body: { userId }
 */
router.delete("/:id", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }

    await Post.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("[POSTS] Error deleting post:", error);
    return res.status(500).json({ error: "Unable to delete post" });
  }
});

/**
 * POST /api/posts/:id/like
 * Toggle like on a post
 * Body: { userId }
 */
router.post("/:id/like", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      // Unlike
      post.likes = post.likes.filter((uid) => uid !== userId);
    } else {
      // Like
      post.likes.push(userId);
    }

    await post.save();

    return res.json({
      success: true,
      liked: !alreadyLiked,
      likeCount: post.likes.length,
      likes: post.likes,
    });
  } catch (error) {
    console.error("[POSTS] Error toggling like:", error);
    return res.status(500).json({ error: "Unable to update like" });
  }
});

/**
 * GET /api/posts/:id/comments
 * Get all comments on a post
 */
router.get("/:id/comments", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id, { comments: 1 }).lean();

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    return res.json({ success: true, comments: post.comments || [] });
  } catch (error) {
    console.error("[POSTS] Error fetching comments:", error);
    return res.status(500).json({ error: "Unable to fetch comments" });
  }
});

/**
 * POST /api/posts/:id/comments
 * Add a comment to a post
 * Body: { userId, userName, userPhoto, text }
 */
router.post("/:id/comments", async (req, res) => {
  try {
    const { userId, userName, userPhoto, text } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text cannot be empty" });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({ error: "Comment is too long (max 1000 characters)" });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comment = {
      userId,
      userName: userName || "Anonymous",
      userPhoto: userPhoto || "",
      text: text.trim(),
    };

    post.comments.push(comment);
    await post.save();

    const savedComment = post.comments[post.comments.length - 1];

    return res.status(201).json({ success: true, comment: savedComment });
  } catch (error) {
    console.error("[POSTS] Error adding comment:", error);
    return res.status(500).json({ error: "Unable to add comment" });
  }
});

/**
 * DELETE /api/posts/:id/comments/:commentId
 * Delete a comment — only the comment author can delete
 * Body: { userId }
 */
router.delete("/:id/comments/:commentId", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own comments" });
    }

    post.comments.pull(req.params.commentId);
    await post.save();

    return res.json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    console.error("[POSTS] Error deleting comment:", error);
    return res.status(500).json({ error: "Unable to delete comment" });
  }
});

/**
 * POST /api/posts/:id/share
 * Increment share count
 * Body: { userId }
 */
router.post("/:id/share", async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { shares: 1 } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    return res.json({ success: true, shares: post.shares });
  } catch (error) {
    console.error("[POSTS] Error incrementing shares:", error);
    return res.status(500).json({ error: "Unable to update share count" });
  }
});

module.exports = router;
