const express = require("express");
const router = express.Router();
const application = require("../Model/Application");
const Resume = require("../Model/Resume");
const Subscription = require("../Model/Subscription");

// POST /api/application - Submit internship or job application
router.post("/", async (req, res) => {
  try {
    let attachedResumeUrl = req.body.resumeUrl || "";
    const userEmail = req.body.user?.email;
    const firebaseUid = req.body.user?.uid || req.body.firebaseUid;

    // Enforce subscription application limits
    if (firebaseUid || userEmail) {
      const subQuery = { $or: [] };
      if (firebaseUid) subQuery.$or.push({ firebaseUid });
      if (userEmail) subQuery.$or.push({ userEmail });

      const userSub = await Subscription.findOne(subQuery);
      const plan = userSub ? userSub.plan : "FREE";
      const maxApps = userSub ? userSub.maxApplications : 1; // 1 for FREE, 3 for BRONZE, 5 for SILVER, -1 for GOLD

      // If not GOLD (unlimited), enforce monthly quota
      if (maxApps !== -1) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const countQuery = {
          $or: [],
          createdAt: { $gte: startOfMonth },
        };
        if (firebaseUid) countQuery.$or.push({ "user.uid": firebaseUid }, { firebaseUid });
        if (userEmail) countQuery.$or.push({ "user.email": userEmail });

        const monthlyCount = await application.countDocuments(countQuery);

        if (monthlyCount >= maxApps) {
          console.warn(`[APPLICATION LIMIT] User ${userEmail || firebaseUid} reached limit (${monthlyCount}/${maxApps}) for plan ${plan}.`);
          return res.status(403).json({
            error: `Your subscription plan (${plan}) allows a maximum of ${maxApps} application${maxApps > 1 ? "s" : ""} per month. Please upgrade your plan to submit more applications.`,
            limitReached: true,
            currentPlan: plan,
            maxApplications: maxApps,
            usedApplications: monthlyCount,
          });
        }
      }
    }

    // Automatically lookup paid resume from Resume collection if not explicitly passed
    if (!attachedResumeUrl && (firebaseUid || userEmail)) {
      const query = firebaseUid ? { firebaseUid } : { email: userEmail };
      const studentResume = await Resume.findOne(query);

      if (studentResume && studentResume.paymentStatus && studentResume.resumeUrl) {
        attachedResumeUrl = studentResume.resumeUrl;
      }
    }

    const applicationipdata = new application({
      company: req.body.company,
      category: req.body.category,
      coverLetter: req.body.coverLetter,
      user: req.body.user,
      Application: req.body.Application,
      body: req.body.body,
      availability: req.body.availability,
      resumeUrl: attachedResumeUrl,
    });

    const savedData = await applicationipdata.save();
    return res.status(200).send(savedData);
  } catch (error) {
    console.error("Error saving application:", error);
    return res.status(500).json({ error: "Failed to save application" });
  }
});

// GET /api/application - Get all applications (Admin / Recruiter)
router.get("/", async (req, res) => {
  try {
    const data = await application.find().sort({ createdAt: -1 });
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/application/:id - Get application by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await application.findById(id);
    if (!data) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching application details:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/application/:id - Update application status (accepted / rejected)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  let status;

  if (action === "accepted") {
    status = "accepted";
  } else if (action === "rejected") {
    status = "rejected";
  } else {
    return res.status(400).json({ error: "Invalid action" });
  }

  try {
    const updateapplication = await application.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
    if (!updateapplication) {
      return res.status(404).json({ error: "Not able to update the application" });
    }
    return res.status(200).json({ success: true, data: updateapplication });
  } catch (error) {
    console.error("Error updating application status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;