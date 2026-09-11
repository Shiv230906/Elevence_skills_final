const express = require("express");
const router = express.Router();
const Friend = require("../Model/Friend");

/**
 * POST /api/friends/request
 * Send a friend request
 * Body: { requesterId, receiverId }
 */
router.post("/request", async (req, res) => {
  try {
    const { requesterId, receiverId } = req.body;

    if (!requesterId || !receiverId) {
      return res.status(400).json({ error: "requesterId and receiverId are required" });
    }

    // Prevent self-request
    if (requesterId === receiverId) {
      return res.status(400).json({ error: "You cannot send a friend request to yourself" });
    }

    // Check if friendship already exists in either direction
    const existing = await Friend.findOne({
      $or: [
        { requester: requesterId, receiver: receiverId },
        { requester: receiverId, receiver: requesterId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ error: "You are already friends with this user" });
      }
      if (existing.status === "pending") {
        return res.status(400).json({ error: "A friend request is already pending" });
      }
      if (existing.status === "rejected") {
        // Allow re-sending if previously rejected
        existing.requester = requesterId;
        existing.receiver = receiverId;
        existing.status = "pending";
        await existing.save();
        return res.json({ success: true, message: "Friend request sent", friendship: existing });
      }
    }

    const friendship = new Friend({
      requester: requesterId,
      receiver: receiverId,
      status: "pending",
    });

    await friendship.save();
    return res.status(201).json({ success: true, message: "Friend request sent", friendship });
  } catch (error) {
    console.error("[FRIENDS] Error sending request:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "A friend request already exists between these users" });
    }
    return res.status(500).json({ error: "Unable to send friend request" });
  }
});

/**
 * GET /api/friends/requests/:userId
 * Get all INCOMING pending friend requests for a user, enriched with requester info
 */
router.get("/requests/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const requests = await Friend.find({
      receiver: userId,
      status: "pending",
    }).sort({ createdAt: -1 });

    // Enrich with requester info from Post collection
    const Post = require("../Model/Post");
    const enriched = await Promise.all(
      requests.map(async (req) => {
        const reqObj = req.toObject();
        try {
          const post = await Post.findOne(
            { userId: reqObj.requester },
            { userName: 1, userPhoto: 1 }
          ).sort({ createdAt: -1 });
          if (post) {
            reqObj.requesterName = post.userName;
            reqObj.requesterPhoto = post.userPhoto;
          }
        } catch (_) {}
        return reqObj;
      })
    );

    return res.json({ success: true, requests: enriched });
  } catch (error) {
    console.error("[FRIENDS] Error fetching requests:", error);
    return res.status(500).json({ error: "Unable to fetch friend requests" });
  }
});

/**
 * GET /api/friends/sent/:userId
 * Get all OUTGOING pending friend requests from a user
 */
router.get("/sent/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await Friend.find({ requester: userId, status: "pending" });
    return res.json({ success: true, requests });
  } catch (error) {
    console.error("[FRIENDS] Error fetching sent requests:", error);
    return res.status(500).json({ error: "Unable to fetch sent requests" });
  }
});

/**
 * POST /api/friends/accept
 * Accept a friend request
 * Body: { friendshipId, userId } — userId must be the receiver
 */
router.post("/accept", async (req, res) => {
  try {
    const { friendshipId, userId } = req.body;

    if (!friendshipId || !userId) {
      return res.status(400).json({ error: "friendshipId and userId are required" });
    }

    const friendship = await Friend.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    // Only the receiver can accept
    if (friendship.receiver !== userId) {
      return res.status(403).json({ error: "You are not authorized to accept this request" });
    }

    if (friendship.status !== "pending") {
      return res.status(400).json({ error: "This request is no longer pending" });
    }

    friendship.status = "accepted";
    await friendship.save();

    return res.json({ success: true, message: "Friend request accepted", friendship });
  } catch (error) {
    console.error("[FRIENDS] Error accepting request:", error);
    return res.status(500).json({ error: "Unable to accept friend request" });
  }
});

/**
 * POST /api/friends/reject
 * Reject a friend request
 * Body: { friendshipId, userId } — userId must be the receiver
 */
router.post("/reject", async (req, res) => {
  try {
    const { friendshipId, userId } = req.body;

    if (!friendshipId || !userId) {
      return res.status(400).json({ error: "friendshipId and userId are required" });
    }

    const friendship = await Friend.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    // Only the receiver can reject
    if (friendship.receiver !== userId) {
      return res.status(403).json({ error: "You are not authorized to reject this request" });
    }

    if (friendship.status !== "pending") {
      return res.status(400).json({ error: "This request is no longer pending" });
    }

    friendship.status = "rejected";
    await friendship.save();

    return res.json({ success: true, message: "Friend request rejected" });
  } catch (error) {
    console.error("[FRIENDS] Error rejecting request:", error);
    return res.status(500).json({ error: "Unable to reject friend request" });
  }
});

/**
 * GET /api/friends/:userId
 * Get all ACCEPTED friends of a user
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const friendships = await Friend.find({
      $or: [{ requester: userId }, { receiver: userId }],
      status: "accepted",
    }).sort({ updatedAt: -1 });

    // Normalize: return the "other" user's ID, enriched with name/photo from Post
    const Post = require("../Model/Post");
    const friends = await Promise.all(
      friendships.map(async (f) => {
        const friendId = f.requester === userId ? f.receiver : f.requester;
        const base = { _id: f._id, friendId, since: f.updatedAt };
        try {
          const post = await Post.findOne({ userId: friendId }, { userName: 1, userPhoto: 1 }).sort({ createdAt: -1 });
          if (post) {
            base.name = post.userName;
            base.photo = post.userPhoto;
          }
        } catch (_) {}
        return base;
      })
    );

    return res.json({ success: true, friends, count: friends.length });
  } catch (error) {
    console.error("[FRIENDS] Error fetching friends:", error);
    return res.status(500).json({ error: "Unable to fetch friends" });
  }
});

/**
 * GET /api/friends/status/:userId/:otherUserId
 * Get the friendship status between two users
 */
router.get("/status/:userId/:otherUserId", async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    const friendship = await Friend.findOne({
      $or: [
        { requester: userId, receiver: otherUserId },
        { requester: otherUserId, receiver: userId },
      ],
    });

    if (!friendship) {
      return res.json({ status: "none", friendship: null });
    }

    return res.json({
      status: friendship.status,
      friendship,
      isSender: friendship.requester === userId,
    });
  } catch (error) {
    console.error("[FRIENDS] Error checking status:", error);
    return res.status(500).json({ error: "Unable to check friendship status" });
  }
});

/**
 * DELETE /api/friends/:friendshipId
 * Remove a friendship (unfriend)
 * Body: { userId }
 */
router.delete("/:friendshipId", async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const friendship = await Friend.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ error: "Friendship not found" });
    }

    // Only parties involved can remove
    if (friendship.requester !== userId && friendship.receiver !== userId) {
      return res.status(403).json({ error: "You are not authorized to remove this friendship" });
    }

    await Friend.findByIdAndDelete(friendshipId);
    return res.json({ success: true, message: "Friend removed successfully" });
  } catch (error) {
    console.error("[FRIENDS] Error removing friend:", error);
    return res.status(500).json({ error: "Unable to remove friend" });
  }
});

module.exports = router;
