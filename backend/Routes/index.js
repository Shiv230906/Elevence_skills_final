const express = require("express");
const router = express.Router();
const admin = require("./admin");
const intern = require("./internship");
const job = require("./job");
const application=require("./application")
const otp = require("./otp");
const resume = require("./resume");
const payment = require("./payment");
const auth = require("./auth");
const friends = require("./friends");
const users = require("./users");
const posts = require("./posts");
const opportunities = require("./opportunities");


router.use("/admin", admin);
router.use("/internship", intern);
router.use("/job", job);
router.use("/application", application);
router.use("/otp", otp);
router.use("/resume", resume);
router.use("/payment", payment);
router.use("/auth", auth);
router.use("/friends", friends);
router.use("/users", users);
router.use("/posts", posts);
router.use("/opportunities", opportunities);

module.exports = router;