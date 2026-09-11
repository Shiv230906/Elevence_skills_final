const crypto = require("crypto");

/**
 * Generates a cryptographically secure random password composed
 * EXCLUSIVELY of uppercase letters (A-Z) and lowercase letters (a-z).
 * NO numbers and NO special characters are included.
 * 
 * @param {number} length Default is 12 characters
 * @returns {string} The generated password
 */
function generateAlphaPassword(length = 12) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const allLetters = upper + lower;

  let passwordChars = [];

  // Guarantee at least one uppercase and one lowercase letter
  const randomUpperIndex = crypto.randomInt(0, upper.length);
  const randomLowerIndex = crypto.randomInt(0, lower.length);
  passwordChars.push(upper[randomUpperIndex]);
  passwordChars.push(lower[randomLowerIndex]);

  // Fill remaining characters strictly with [a-zA-Z]
  for (let i = 2; i < length; i++) {
    const randomIndex = crypto.randomInt(0, allLetters.length);
    passwordChars.push(allLetters[randomIndex]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  const result = passwordChars.join("");

  // Safety regex assertion: ONLY A-Z and a-z
  if (!/^[a-zA-Z]+$/.test(result)) {
    throw new Error("Password generator generated invalid characters!");
  }

  return result;
}

module.exports = {
  generateAlphaPassword,
};
