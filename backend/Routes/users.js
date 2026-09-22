const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Post = require("../Model/Post");
const Friend = require("../Model/Friend");
const User = require("../Model/User");

/**
 * GET /api/users/search?q=searchTerm&userId=currentUserId
 * Search real registered users by name, email, or username from the User collection
 * Fallback/merge with distinct users from Post collection
 */
router.get("/search", async (req, res) => {
  try {
    const { q, userId } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json({ success: true, users: [] });
    }

    const searchRegex = new RegExp(q.trim(), "i");

    // 1. Primary: Search real registered users from MongoDB User collection
    const userQuery = {
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
      ],
    };

    if (userId) {
      userQuery.$and = [
        { firebaseUid: { $ne: userId } },
        ...(mongoose.isValidObjectId(userId) ? [{ _id: { $ne: new mongoose.Types.ObjectId(userId) } }] : []),
      ];
    }

    const matchedUsers = await User.find(userQuery, {
      firebaseUid: 1,
      name: 1,
      email: 1,
      profilePhoto: 1,
      username: 1,
    }).limit(50);

    const seen = new Set();
    const users = [];

    for (const u of matchedUsers) {
      const effectiveId = u.firebaseUid || u._id.toString();
      if (!seen.has(effectiveId)) {
        seen.add(effectiveId);
        users.push({
          userId: effectiveId,
          name: u.name || "User",
          photo: u.profilePhoto || "",
          email: u.email || "",
        });
      }
    }

    // 2. Secondary: Supplement from Post collection if any legacy users haven't synced
    const matchingPosts = await Post.find(
      { userName: searchRegex },
      { userId: 1, userName: 1, userPhoto: 1, userEmail: 1 }
    ).limit(50);

    for (const post of matchingPosts) {
      if (post.userId && !seen.has(post.userId)) {
        if (userId && post.userId === userId) continue;
        seen.add(post.userId);
        users.push({
          userId: post.userId,
          name: post.userName || "User",
          photo: post.userPhoto || "",
          email: post.userEmail || "",
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
          userId: userDoc.firebaseUid || userDoc._id.toString(),
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
 * Upsert real user profile into MongoDB User collection
 * Body: { userId, name, photo, email }
 */
router.post("/register", async (req, res) => {
  try {
    const { userId, name, photo, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const cleanEmail = email ? email.toLowerCase().trim() : undefined;
    const cleanName = (name && name.trim()) || "User";
    const cleanPhoto = photo || "";

    // Find existing user by firebaseUid or email
    let user = await User.findOne({
      $or: [
        { firebaseUid: userId },
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(mongoose.isValidObjectId(userId) ? [{ _id: userId }] : []),
      ],
    });

    if (user) {
      if (!user.firebaseUid) user.firebaseUid = userId;
      if (cleanName && (!user.name || user.name === "User")) user.name = cleanName;
      if (cleanPhoto && !user.profilePhoto) user.profilePhoto = cleanPhoto;
      if (cleanEmail && !user.email) user.email = cleanEmail;
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      user = new User({
        firebaseUid: userId,
        name: cleanName,
        email: cleanEmail,
        profilePhoto: cleanPhoto,
        role: "user",
        lastLoginAt: new Date(),
      });
      await user.save();
    }

    return res.json({
      success: true,
      message: "User registered successfully",
      user: {
        userId: user.firebaseUid || user._id.toString(),
        name: user.name,
        photo: user.profilePhoto,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[USERS] Error registering user:", error);
    return res.status(500).json({ error: "Unable to register user" });
  }
});

module.exports = router;
