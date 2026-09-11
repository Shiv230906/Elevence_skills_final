/**
 * Indian Standard Time (IST, UTC+5:30) Time Helper Utilities
 */

/**
 * Returns a Date object representing the current moment in IST
 */
function getISTDate() {
  const now = new Date();
  const utcOffset = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60000; // +5:30 in ms
  return new Date(utcOffset + istOffset);
}

/**
 * Returns current IST formatted string, e.g. "10:30 AM IST, Aug 31, 2026"
 */
function getFormattedIST(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date) + " IST";
}

/**
 * Checks if current IST time is between 10:00 AM and 1:00 PM IST (inclusive)
 * 10:00 AM = 10 * 60 = 600 minutes
 * 1:00 PM = 13 * 60 = 780 minutes
 */
function isMobileLoginTimeAllowed() {
  const ist = getISTDate();
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 10:00 AM (600) to 1:00 PM (780)
  return totalMinutes >= 600 && totalMinutes <= 780;
}

/**
 * Checks if current IST time is between 10:00 AM and 11:00 AM IST (inclusive)
 * 10:00 AM = 10 * 60 = 600 minutes
 * 11:00 AM = 11 * 60 = 660 minutes
 */
function isSubscriptionPaymentTimeAllowed() {
  const ist = getISTDate();
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 10:00 AM (600) to 11:00 AM (660)
  return totalMinutes >= 600 && totalMinutes <= 660;
}

/**
 * Returns UTC Date range for the start and end of the current day in IST
 */
function getISTDayRange(date = new Date()) {
  // Convert given date to IST components
  const istDateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // Format: YYYY-MM-DD

  // Start of IST day is YYYY-MM-DDT00:00:00+05:30
  const startOfDay = new Date(`${istDateString}T00:00:00+05:30`);
  // End of IST day is YYYY-MM-DDT23:59:59.999+05:30
  const endOfDay = new Date(`${istDateString}T23:59:59.999+05:30`);

  return { startOfDay, endOfDay };
}

module.exports = {
  getISTDate,
  getFormattedIST,
  isMobileLoginTimeAllowed,
  isSubscriptionPaymentTimeAllowed,
  getISTDayRange,
};
