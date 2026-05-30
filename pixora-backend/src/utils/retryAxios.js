const axios = require('axios');

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 500, // ms
  maxDelay: 5000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
};

const RATE_LIMIT_HEADERS = {
  retryAfter: 'retry-after',
  rateLimitRemaining: 'x-ratelimit-remaining',
  rateLimitReset: 'x-ratelimit-reset',
  rateLimitLimit: 'x-ratelimit-limit',
};

/**
 * Retry axios request with exponential backoff
 * Respects Retry-After header for 429 responses
 * @param {object} config - axios config
 * @param {object} retryConfig - retry configuration
 * @returns {Promise} axios response
 */
async function retryAxiosRequest(config, retryConfig = DEFAULT_RETRY_CONFIG) {
  let lastError;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await axios(config);
    } catch (err) {
      lastError = err;

      const status = err.response?.status;
      const headers = err.response?.headers || {};
      const code = err.code;

      // Special handling for 429 (Too Many Requests)
      if (status === 429) {
        const retryAfter = parseInt(headers[RATE_LIMIT_HEADERS.retryAfter]) || 60;
        const delayMs = retryAfter * 1000;

        console.warn(
          `[Rate Limited] ${config.url} returned 429. Waiting ${delayMs}ms before retry. ` +
          `Remaining: ${headers[RATE_LIMIT_HEADERS.rateLimitRemaining] || '?'}/${headers[RATE_LIMIT_HEADERS.rateLimitLimit] || '?'}`
        );

        if (attempt < retryConfig.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }

      const isRetryable =
        retryConfig.retryableStatusCodes.includes(status) ||
        retryConfig.retryableErrors.includes(code);

      if (!isRetryable || attempt === retryConfig.maxRetries) {
        throw err;
      }

      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
        retryConfig.maxDelay
      );

      console.log(
        `[Retry] Attempt ${attempt + 1}/${retryConfig.maxRetries} ` +
        `after ${delay}ms (${status || code || 'unknown error'}) - ${config.url}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = { retryAxiosRequest, DEFAULT_RETRY_CONFIG, RATE_LIMIT_HEADERS };
