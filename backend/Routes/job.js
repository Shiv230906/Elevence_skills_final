const express = require("express");
const router = express.Router();
const Job = require("../Model/Job");

router.post("/", async (req, res) => {
  try {
    const perksData = typeof req.body.perks === "string"
      ? req.body.perks.split(",").map((p) => p.trim()).filter(Boolean)
      : (Array.isArray(req.body.perks) ? req.body.perks : []);

    const startDate = req.body.startDate || req.body.StartDate || "";
    const additionalInfo = req.body.AdditionalInfo || req.body.additionalInfo || "";

    const jobdata = new Job({
      title: req.body.title,
      company: req.body.company,
      location: req.body.location,
      Experience: req.body.Experience || "0-2 years",
      category: req.body.category,
      aboutCompany: req.body.aboutCompany,
      aboutJob: req.body.aboutJob,
      whoCanApply: req.body.whoCanApply,
      perks: perksData,
      numberOfOpening: String(req.body.numberOfOpening || req.body.numberOfopening || "1"),
      AdditionalInfo: additionalInfo,
      additionalInfo: additionalInfo,
      CTC: req.body.CTC,
      StartDate: startDate,
      startDate: startDate,
      createdAt: new Date(),
    });

    const savedData = await jobdata.save();
    return res.status(200).send(savedData);
  } catch (error) {
    console.error("Error saving job:", error);
    return res.status(500).json({ error: "Failed to save job to database" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { q, category, location } = req.query;
    const filter = {};

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [
        { title: regex },
        { company: regex },
        { category: regex },
        { location: regex },
        { aboutJob: regex },
        { whoCanApply: regex },
      ];
    }

    if (category && category.trim()) {
      filter.category = new RegExp(category.trim(), "i");
    }

    if (location && location.trim()) {
      filter.location = new RegExp(location.trim(), "i");
    }

    const data = await Job.find(filter).sort({ createdAt: -1 });
    res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await Job.findById(id);
    if (!data) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "internal server error" });
  }
});

module.exports = router;