const mongoose = require("mongoose");
const Applicationipschema = new mongoose.Schema({
  company: String,
  category: String,
  coverLetter: String,
  user: Object,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["accepted", "pending", "rejected"],
    default: "pending",
  },
  resumeUrl: {
    type: String,
    default: "",
},
  Application: Object,
  availability: String,
  
});
module.exports = mongoose.model("Application", Applicationipschema);