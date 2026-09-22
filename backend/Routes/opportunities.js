const express = require("express");
const router = express.Router();
const Internship = require("../Model/Internship");
const Job = require("../Model/Job");

/**
 * GET /api/opportunities/search?q=keyword&limit=10
 * Unified search across both Internships and Jobs
 */
router.get("/search", async (req, res) => {
  try {
    const { q, limit = 8 } = req.query;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.json({
        success: true,
        query: "",
        internships: [],
        jobs: [],
        total: 0,
      });
    }

    const trimmedQuery = q.trim();
    const regex = new RegExp(trimmedQuery, "i");
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 50);

    const filter = {
      $or: [
        { title: regex },
        { company: regex },
        { category: regex },
        { location: regex },
      ],
    };

    const [internships, jobs] = await Promise.all([
      Internship.find(filter)
        .sort({ createdAt: -1 })
        .limit(parsedLimit)
        .select("_id title company location category stipend startDate createdAt"),
      Job.find(filter)
        .sort({ createdAt: -1 })
        .limit(parsedLimit)
        .select("_id title company location category CTC Experience startDate createdAt"),
    ]);

    return res.json({
      success: true,
      query: trimmedQuery,
      internships,
      jobs,
      total: internships.length + jobs.length,
    });
  } catch (error) {
    console.error("[OPPORTUNITIES SEARCH] Error:", error);
    return res.status(500).json({ error: "Failed to search opportunities" });
  }
});

module.exports = router;
