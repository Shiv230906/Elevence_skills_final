/**
 * Community Posting Limits Configuration
 * 
 * Explicit Rules:
 * - 0 friends: 0 posts/day (Cannot post)
 * - 1 friend: 1 post/day
 * - 2 friends: 2 posts/day
 * - More than 10 friends: Unlimited (Infinity)
 * 
 * Configurable Range for 3-10 friends:
 * This mapping defines the exact daily allowed posts for users with 3 to 10 friends.
 * Easily adjust values here without modifying business logic.
 */

const COMMUNITY_POSTING_LIMITS = {
  // Explicit rules
  0: 0,
  1: 1,
  2: 2,

  // Configurable tier for 3-10 friends
  // Default configuration: progressive scaling (3->3, 4->4, 5->5, 6->6, 7->7, 8->8, 9->9, 10->10)
  tier3to10: {
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10,
    // Fallback default for any value in [3, 10] if not explicitly mapped above
    defaultLimit: 3,
  },

  // Rule for > 10 friends
  greaterThan10: Infinity,
};

/**
 * Calculates the allowed daily post limit for a given friend count
 * @param {number} friendCount 
 * @returns {number} Allowed daily posts (Infinity for unlimited, 0 for blocked)
 */
function getDailyPostLimit(friendCount) {
  const count = Math.max(0, parseInt(friendCount, 10) || 0);

  if (count === 0) return COMMUNITY_POSTING_LIMITS[0]; // 0
  if (count === 1) return COMMUNITY_POSTING_LIMITS[1]; // 1
  if (count === 2) return COMMUNITY_POSTING_LIMITS[2]; // 2

  if (count > 10) {
    return COMMUNITY_POSTING_LIMITS.greaterThan10; // Infinity
  }

  // 3 to 10 friends
  const tierConfig = COMMUNITY_POSTING_LIMITS.tier3to10;
  if (tierConfig && tierConfig[count] !== undefined) {
    return tierConfig[count];
  }

  return tierConfig ? tierConfig.defaultLimit : count;
}

module.exports = {
  COMMUNITY_POSTING_LIMITS,
  getDailyPostLimit,
};
