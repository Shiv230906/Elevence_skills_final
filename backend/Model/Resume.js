const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    phone: String,
    address: String,
    linkedin: String,
    github: String,
    portfolio: String,
    summary: String,
    photo: String,

    education: [
      {
        institution: String,
        degree: String,
        field: String,
        startYear: String,
        endYear: String,
        cgpa: String,
      },
    ],

    experience: [
      {
        company: String,
        role: String,
        startDate: String,
        endDate: String,
        description: String,
      },
    ],

    projects: [
      {
        title: String,
        description: String,
        technologies: [String],
        github: String,
        liveLink: String,
      },
    ],

    skills: [String],

    certifications: [
      {
        title: String,
        organization: String,
        year: String,
      },
    ],

    achievements: [String],

    languages: [String],

    resumeUrl: {
      type: String,
      default: "",
    },

    selectedTemplate: {
      type: String,
      default: "Modern",
    },

    // Step 1: Premium Membership Access (₹300)
    isPremium: {
      type: Boolean,
      default: false,
    },
    premiumPaymentId: String,
    premiumOrderId: String,
    premiumPaymentDate: Date,

    // Step 2: Resume PDF Generation & Download Payment (₹50 per resume)
    paymentStatus: {
      type: Boolean,
      default: false,
    },
    paymentId: String,
    orderId: String,
    paymentDate: Date,

    // Individual ₹50 resume generation payment records
    pdfPayments: [
      {
        paymentId: { type: String, required: true },
        orderId: { type: String, required: true },
        amount: { type: Number, default: 50 },
        paymentDate: { type: Date, default: Date.now },
        resumeUrl: { type: String, default: "" },
        generatedAt: { type: Date },
        isUsed: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Resume", ResumeSchema);