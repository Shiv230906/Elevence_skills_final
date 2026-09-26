require("dotenv").config();
const bodyparser = require("body-parser");
const express = require("express");
const app = express();
const cors = require("cors");
const { connect } = require("./db");
const router = require("./Routes/index");
const port = process.env.PORT || 5000;
const path = require("path");

// ── Allowed CORS origins ──────────────────────────────────────────────────────
const allowedOrigins = [
  "https://elevance-skills-final.vercel.app",
  "https://elevence-skills-final.vercel.app",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
];

// ── CORS middleware ───────────────────────────────────────────────────────────
// Explicitly reflects the requesting origin (not wildcard *) so that
// credentials: true works correctly in browsers.
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow non-browser requests (server-to-server, curl, Postman) with no Origin header
      if (!origin) return callback(null, true);

      // Allow any Vercel preview/production deployment and known origins
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }

      // Reject unknown origins with a descriptive error (shown in browser console)
      return callback(new Error(`CORS: Origin '${origin}' is not allowed.`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "x-user-id",
    ],
  })
);

// Pre-flight OPTIONS handled by the global cors() middleware above

app.use(bodyparser.json({ limit: "50mb" }));
app.use(bodyparser.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/resumes", express.static(path.join(__dirname, "uploads/resumes")));
app.use("/media", express.static(path.join(__dirname, "uploads/media")));

// ── Health check endpoint — used to verify Render deployment is live ──────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "elevance-backend",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
    db: require("mongoose").connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.get("/", (req, res) => {
  res.send("hello this is internshala backend");
});

app.use("/api", router);
connect();

app.listen(port, () => {
  console.log(`Server is running on the port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Health check: http://localhost:${port}/health`);
});