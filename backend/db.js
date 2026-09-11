const mongoose = require("mongoose");
const dns = require("dns");
require("dotenv").config();

// Ensure Node.js c-ares DNS resolver can resolve MongoDB Atlas SRV records
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (dnsErr) {
  console.warn("Could not set custom DNS servers:", dnsErr.message);
}

const url = process.env.DATABASE_URL;

// Retry connection with exponential backoff
async function connectWithRetry(retries = 5, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(url, {
        // Force IPv4 to avoid IPv6 DNS resolution issues on Windows
        family: 4,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      console.log("Database is connected");
      return;
    } catch (error) {
      console.error(`Database connection attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt < retries) {
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 15000); // exponential backoff, cap at 15s
      }
    }
  }
  console.error("All database connection attempts failed. Server continues without DB.");
}

module.exports.connect = connectWithRetry;