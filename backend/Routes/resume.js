const express = require("express");
const router = express.Router();
const Resume = require("../Model/Resume");
const PDFDocument = require("pdfkit");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Function to generate PDF Buffer from Resume document
const createPdfBuffer = (data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    let buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on("error", (err) => reject(err));

    // Title / Header
    doc.fillColor("#1E3A8A").fontSize(24).font("Helvetica-Bold").text(data.name || "Resume", { align: "center" });
    doc.moveDown(0.3);

    // Contact details line
    const contacts = [data.email, data.phone, data.address].filter(Boolean).join(" | ");
    doc.fillColor("#475569").fontSize(10).font("Helvetica").text(contacts, { align: "center" });

    const links = [data.linkedin, data.github, data.portfolio].filter(Boolean).join(" | ");
    if (links) {
      doc.fillColor("#2563EB").fontSize(9).font("Helvetica").text(links, { align: "center" });
    }
    doc.moveDown(0.8);

    // Horizontal Rule
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#CBD5E1").lineWidth(1).stroke();
    doc.moveDown(0.8);

    // Summary Section
    if (data.summary) {
      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("PROFESSIONAL SUMMARY");
      doc.moveDown(0.3);
      doc.fillColor("#334155").fontSize(10).font("Helvetica").text(data.summary, { align: "justify" });
      doc.moveDown(0.8);
    }

    // Work Experience
    if (data.experience && data.experience.length > 0) {
      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("WORK EXPERIENCE");
      doc.moveDown(0.4);

      data.experience.forEach((exp) => {
        if (exp.role || exp.company) {
          doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(`${exp.role || ""} - ${exp.company || ""}`);
          if (exp.startDate || exp.endDate) {
            doc.fillColor("#64748B").fontSize(9).font("Helvetica-Oblique").text(`${exp.startDate || ""} - ${exp.endDate || ""}`);
          }
          if (exp.description) {
            doc.fillColor("#334155").fontSize(9.5).font("Helvetica").text(exp.description);
          }
          doc.moveDown(0.5);
        }
      });
      doc.moveDown(0.4);
    }

    // Education
    if (data.education && data.education.length > 0) {
      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("EDUCATION");
      doc.moveDown(0.4);

      data.education.forEach((edu) => {
        if (edu.institution) {
          doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(edu.institution);
          doc.fillColor("#334155").fontSize(9.5).font("Helvetica").text(`${edu.degree || ""} ${edu.field ? `in ${edu.field}` : ""} (${edu.startYear || ""} - ${edu.endYear || ""}) ${edu.cgpa ? `| CGPA: ${edu.cgpa}` : ""}`);
          doc.moveDown(0.4);
        }
      });
      doc.moveDown(0.4);
    }

    // Projects
    if (data.projects && data.projects.length > 0) {
      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("PROJECTS");
      doc.moveDown(0.4);

      data.projects.forEach((proj) => {
        if (proj.title) {
          doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(proj.title);
          if (proj.technologies && proj.technologies.length > 0) {
            doc.fillColor("#2563EB").fontSize(9).font("Helvetica").text(`Technologies: ${proj.technologies.join(", ")}`);
          }
          if (proj.description) {
            doc.fillColor("#334155").fontSize(9.5).font("Helvetica").text(proj.description);
          }
          doc.moveDown(0.4);
        }
      });
      doc.moveDown(0.4);
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("SKILLS");
      doc.moveDown(0.3);
      doc.fillColor("#334155").fontSize(9.5).font("Helvetica").text(data.skills.join(" • "));
      doc.moveDown(0.8);
    }

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("CERTIFICATIONS");
      doc.moveDown(0.3);
      data.certifications.forEach((cert) => {
        if (cert.title) {
          doc.fillColor("#334155").fontSize(9.5).font("Helvetica").text(`• ${cert.title} - ${cert.organization || ""} ${cert.year ? `(${cert.year})` : ""}`);
        }
      });
      doc.moveDown(0.8);
    }

    // Achievements
    if (data.achievements && data.achievements.length > 0) {
      doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("ACHIEVEMENTS");
      doc.moveDown(0.3);
      data.achievements.forEach((ach) => {
        if (ach) {
          doc.fillColor("#334155").fontSize(9.5).font("Helvetica").text(`• ${ach}`);
        }
      });
    }

    doc.end();
  });
};

// POST /api/resume/generate-pdf - Generate PDF Resume (Requires Premium + ₹50 per resume)
router.post("/generate-pdf", async (req, res) => {
  try {
    const { firebaseUid, paymentId } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ success: false, error: "Firebase UID is required" });
    }

    const resume = await Resume.findOne({ firebaseUid });

    if (!resume) {
      return res.status(404).json({ success: false, error: "Resume draft not found" });
    }

    // 1. Business Rule: Non-premium user cannot generate PDF
    if (!resume.isPremium) {
      return res.status(403).json({
        success: false,
        error: "Premium membership is required to access the Resume Builder. Please upgrade to Premium first.",
      });
    }

    // 2. Business Rule: Generating each resume/PDF costs ₹50 separately
    // Search for a valid, unused ₹50 payment in pdfPayments
    let matchedPayment = null;
    if (Array.isArray(resume.pdfPayments)) {
      if (paymentId) {
        matchedPayment = resume.pdfPayments.find(
          (p) => p.paymentId === paymentId && p.isUsed === false
        );
      }
      if (!matchedPayment) {
        // Fallback: match latest unused ₹50 payment
        matchedPayment = resume.pdfPayments.find((p) => p.isUsed === false);
      }
    }

    if (!matchedPayment) {
      return res.status(403).json({
        success: false,
        error: "Generating each resume requires a separate ₹50 payment. Please complete the ₹50 payment to generate this resume.",
      });
    }

    const pdfBuffer = await createPdfBuffer(resume);
    let finalUrl = "";

    // Try Cloudinary upload if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: "raw", format: "pdf", folder: "resumes", public_id: `resume_${firebaseUid}_${Date.now()}` },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          stream.end(pdfBuffer);
        });
        finalUrl = uploadResult.secure_url;
      } catch (cloudErr) {
        console.error("Cloudinary upload failed, falling back to local storage:", cloudErr);
      }
    }

    // Local Storage Fallback if Cloudinary not set or fails
    if (!finalUrl) {
      const resumesDir = path.join(__dirname, "../uploads/resumes");
      if (!fs.existsSync(resumesDir)) {
        fs.mkdirSync(resumesDir, { recursive: true });
      }
      const filename = `resume_${firebaseUid}_${Date.now()}.pdf`;
      const filePath = path.join(resumesDir, filename);
      fs.writeFileSync(filePath, pdfBuffer);

      const host = req.get("host") || "localhost:5000";
      const protocol = req.protocol || "http";
      finalUrl = `${protocol}://${host}/resumes/${filename}`;
    }

    // 3. Mark this individual ₹50 payment as used with timestamp & generated resumeUrl
    matchedPayment.isUsed = true;
    matchedPayment.resumeUrl = finalUrl;
    matchedPayment.generatedAt = new Date();

    resume.resumeUrl = finalUrl;
    resume.markModified("pdfPayments");
    await resume.save();

    console.log(`[RESUME PDF] Generated PDF for UID: ${firebaseUid} linked to Payment: ${matchedPayment.paymentId}`);

    return res.status(200).json({
      success: true,
      message: "Professional PDF resume generated successfully",
      resumeUrl: finalUrl,
      paymentId: matchedPayment.paymentId,
      data: resume,
    });
  } catch (error) {
    console.error("Error generating PDF resume:", error);
    return res.status(500).json({ success: false, error: "Failed to generate PDF resume" });
  }
});

// POST /api/resume - Create or Update Resume (Upsert)
router.post("/", async (req, res) => {
  try {
    const { firebaseUid, name, email } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ error: "Firebase UID is required" });
    }

    if (!name || !email) {
      return res.status(400).json({ error: "Name and Email are required fields" });
    }

    let existingResume = await Resume.findOne({ firebaseUid });

    if (existingResume) {
      const updatedResume = await Resume.findOneAndUpdate(
        { firebaseUid },
        { $set: req.body },
        { new: true, runValidators: true }
      );
      return res.status(200).json(updatedResume);
    }

    const newResume = new Resume(req.body);
    const savedResume = await newResume.save();
    return res.status(200).json(savedResume);
  } catch (error) {
    console.error("Error saving resume:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/resume - Get all resumes
router.get("/", async (req, res) => {
  try {
    const resumes = await Resume.find().sort({ createdAt: -1 });
    return res.status(200).json(resumes);
  } catch (error) {
    console.error("Error fetching resumes:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/resume/:firebaseUid - Get Resume by Firebase UID
router.get("/:firebaseUid", async (req, res) => {
  const { firebaseUid } = req.params;
  try {
    const resume = await Resume.findOne({ firebaseUid });
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }
    return res.status(200).json(resume);
  } catch (error) {
    console.error("Error fetching resume:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/resume/:firebaseUid - Delete Resume by Firebase UID
router.delete("/:firebaseUid", async (req, res) => {
  const { firebaseUid } = req.params;
  try {
    const deletedResume = await Resume.findOneAndDelete({ firebaseUid });
    if (!deletedResume) {
      return res.status(404).json({ error: "Resume not found" });
    }
    return res.status(200).json({ message: "Resume deleted successfully" });
  } catch (error) {
    console.error("Error deleting resume:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;