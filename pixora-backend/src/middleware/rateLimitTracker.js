/**
 * Rate limit state tracker
 * Monitors API rate limits and alerts when approaching limits
 */

const rateLimitState = new Map();

function parseRateLimitHeaders(headers) {
  return {
    remaining: parseInt(headers['x-ratelimit-remaining']) || null,
    limit: parseInt(headers['x-ratelimit-limit']) || null,
    reset: parseInt(headers['x-ratelimit-reset']) || null,
  };
}

function updateRateLimitState(source, headers) {
  const state = parseRateLimitHeaders(headers);
  rateLimitState.set(source, {
    ...state,
    lastUpdated: Date.now(),
  });

  if (state.remaining !== null && state.limit !== null) {
    const percent = ((state.remaining / state.limit) * 100).toFixed(1);
    console.log(
      `[Rate Limit] ${source}: ${state.remaining}/${state.limit} (${percent}%)`
    );

    // Alert if approaching limit
    if (state.remaining < state.limit * 0.1) {
      console.warn(
        `⚠️  WARNING: ${source} rate limit critical (${percent}% remaining)`
      );
    }
  }
}

function getRateLimitState(source) {
  return rateLimitState.get(source);
}

function getAllRateLimitStates() {
  const result = {};
  for (const [source, state] of rateLimitState) {
    result[source] = state;
  }
  return result;
}

module.exports = {
  updateRateLimitState,
  getRateLimitState,
  getAllRateLimitStates,
  parseRateLimitHeaders,
};
