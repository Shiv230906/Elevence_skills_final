const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../Model/User");

const adminuser = process.env.ADMIN_USER || "admin";
const adminpass = process.env.ADMIN_PASS || "admin";
const legacyUser = "shivanif53_db_user";
const legacyPass = "Lvj3f96fMKCXYGKl";

router.post("/adminlogin", async (req, res) => {
  const { username, password } = req.body;

  // 1. Check if admin user in database has an updated bcrypt password
  try {
    const adminUserDoc = await User.findOne({
      $or: [
        { role: "admin" },
        { email: (username || "").toLowerCase().trim() },
        { name: username },
      ],
      password: { $ne: null },
    });

    if (adminUserDoc && adminUserDoc.password) {
      const isMatch = bcrypt.compareSync(password, adminUserDoc.password);
      if (isMatch) {
        return res.send("admin is here");
      }
    }
  } catch (err) {
    console.warn("[ADMIN LOGIN] Error checking DB password:", err.message);
  }

  // 2. Check static/env credentials as fallback
  if (
    (username === adminuser && password === adminpass) ||
    (username === "admin" && password === "admin123") ||
    (username === legacyUser && password === legacyPass)
  ) {
    res.send("admin is here");
  } else {
    res.status(401).send("unauthorized");
  }
});
module.exports = router;