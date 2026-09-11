const { UAParser } = require("ua-parser-js");

/**
 * Parses user agent and request headers to extract device, browser, OS, and IP
 * @param {import("express").Request} req
 */
function detectDeviceInfo(req) {
  const userAgentString = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  // Browser detection
  const rawBrowserName = result.browser.name || "";
  let browser = rawBrowserName || "Unknown Browser";
  if (result.browser.version) {
    browser = `${browser} ${result.browser.version.split(".")[0]}`;
  }

  // Check if Chrome (or Chromium-based Google Chrome)
  // Note: Edge and Opera use Blink/Chromium, but Chrome specifically identifies as Chrome/Google Chrome
  const isChrome = /Chrome|CriOS/i.test(userAgentString) && !/Edg|OPR|Brave|Vivaldi|SamsungBrowser/i.test(userAgentString);

  // OS detection
  let os = result.os.name || "Unknown OS";
  if (result.os.version) {
    os = `${os} ${result.os.version}`;
  }

  // Device classification: Desktop, Laptop, Mobile, Tablet
  const rawDeviceType = result.device.type; // "mobile", "tablet", undefined
  let deviceType = "Desktop";
  let isMobile = false;

  if (rawDeviceType === "mobile" || /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgentString)) {
    deviceType = "Mobile";
    isMobile = true;
  } else if (rawDeviceType === "tablet" || /iPad/i.test(userAgentString)) {
    deviceType = "Mobile"; // Mobile/Tablet category for time restrictions
    isMobile = true;
  } else {
    // Check if laptop or desktop based on OS/UA hints
    if (/Macintosh|Mac OS X|Windows NT|Linux/i.test(userAgentString)) {
      // Default to Desktop/Laptop
      deviceType = req.headers["sec-ch-ua-mobile"] === "?1" ? "Mobile" : "Desktop";
    }
  }

  // Client IP extraction
  let ip =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "127.0.0.1";

  if (typeof ip === "string" && ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }
  // Normalize IPv6 localhost
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    ip = "127.0.0.1";
  }

  return {
    browser,
    os,
    deviceType,
    isChrome,
    isMobile,
    ipAddress: ip,
    rawUserAgent: userAgentString,
  };
}

module.exports = {
  detectDeviceInfo,
};
