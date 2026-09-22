const express = require("express");
const router = express.Router();
const Internship = require("../Model/Internship");

router.post("/", async (req, res) => {
  try {
    const perksData = typeof req.body.perks === "string"
      ? req.body.perks.split(",").map((p) => p.trim()).filter(Boolean)
      : (Array.isArray(req.body.perks) ? req.body.perks : []);

    const startDate = req.body.startDate || req.body.StartDate || "";
    const additionalInfo = req.body.additionalInfo || req.body.AdditionalInfo || "";

    const Internshipdata = new Internship({
      title: req.body.title,
      company: req.body.company,
      location: req.body.location,
      category: req.body.category,
      aboutCompany: req.body.aboutCompany,
      aboutInternship: req.body.aboutInternship,
      whoCanApply: req.body.whoCanApply,
      perks: perksData,
      numberOfOpening: String(req.body.numberOfOpening || req.body.numberOfopening || "1"),
      stipend: req.body.stipend,
      startDate: startDate,
      StartDate: startDate,
      additionalInfo: additionalInfo,
      AdditionalInfo: additionalInfo,
      createdAt: new Date(),
    });

    const savedData = await Internshipdata.save();
    return res.status(200).send(savedData);
  } catch (error) {
    console.error("Error saving internship:", error);
    return res.status(500).json({ error: "Failed to save internship to database" });
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
        { aboutInternship: regex },
        { whoCanApply: regex },
      ];
    }

    if (category && category.trim()) {
      filter.category = new RegExp(category.trim(), "i");
    }

    if (location && location.trim()) {
      filter.location = new RegExp(location.trim(), "i");
    }

    const data = await Internship.find(filter).sort({ createdAt: -1 });
    res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await Internship.findById(id);
    if (!data) {
      return res.status(404).json({ error: "Internship not found" });
    }
    res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "internal server error" });
  }
});

module.exports = router;