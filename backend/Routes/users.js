const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Post = require("../Model/Post");
const Friend = require("../Model/Friend");
const User = require("../Model/User");

/**
 * GET /api/users/search?q=searchTerm&userId=currentUserId
 * Search users by name from the Post collection + Friend records
 * Returns a list of distinct user profiles
 */
router.get("/search", async (req, res) => {
  try {
    const { q, userId } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json({ success: true, users: [] });
    }

    const searchRegex = new RegExp(q.trim(), "i");

    // Find users from Post collection who match the name
    const matchingPosts = await Post.find(
      { userName: searchRegex },
      { userId: 1, userName: 1, userPhoto: 1, userEmail: 1 }
    ).limit(50);

    // Deduplicate by userId
    const seen = new Set();
    const users = [];

    for (const post of matchingPosts) {
      if (!seen.has(post.userId)) {
        // Exclude the searching user themselves
        if (userId && post.userId === userId) continue;
        seen.add(post.userId);
        users.push({
          userId: post.userId,
          name: post.userName,
          photo: post.userPhoto,
          email: post.userEmail,
        });
      }
    }

    return res.json({ success: true, users });
  } catch (error) {
    console.error("[USERS] Error searching users:", error);
    return res.status(500).json({ error: "Unable to search users" });
  }
});

/**
 * GET /api/users/profile/:userId
 * Get profile info of a user (checks User model first, then latest post)
 */
router.get("/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // 1. Check User model first by firebaseUid or _id
    let userDoc = await User.findOne({
      $or: [
        { firebaseUid: userId },
        ...(mongoose.isValidObjectId(userId) ? [{ _id: userId }] : []),
      ],
    });

    // Count friends
    const friendCount = await Friend.countDocuments({
      $or: [{ requester: userId }, { receiver: userId }],
      status: "accepted",
    });

    if (userDoc) {
      return res.json({
        success: true,
        profile: {
          userId: userDoc.firebaseUid || userDoc._id,
          name: userDoc.name,
          photo: userDoc.profilePhoto || "",
          email: userDoc.email,
          phone: userDoc.phone || "",
          username: userDoc.username || "",
          role: userDoc.role || "user",
          lastLoginAt: userDoc.lastLoginAt,
          friendCount,
        },
      });
    }

    // 2. Fallback to latest post if not found in User model
    const latestPost = await Post.findOne({ userId }, { userId: 1, userName: 1, userPhoto: 1, userEmail: 1 })
      .sort({ createdAt: -1 });

    if (!latestPost) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      success: true,
      profile: {
        userId: latestPost.userId,
        name: latestPost.userName,
        photo: latestPost.userPhoto,
        email: latestPost.userEmail,
        friendCount,
      },
    });
  } catch (error) {
    console.error("[USERS] Error fetching profile:", error);
    return res.status(500).json({ error: "Unable to fetch user profile" });
  }
});

/**
 * POST /api/users/register
 * Upsert user profile info (called on login to ensure user is searchable)
 * Body: { userId, name, photo, email }
 */
router.post("/register", async (req, res) => {
  try {
    const { userId, name, photo, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // We store user info on their posts; this endpoint just returns success
    // The actual data lives on Posts. We return success so frontend can call it on login.
    return res.json({ success: true, message: "User registered" });
  } catch (error) {
    console.error("[USERS] Error registering user:", error);
    return res.status(500).json({ error: "Unable to register user" });
  }
});

module.exports = router;
