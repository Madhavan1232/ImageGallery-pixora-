/**
 * Circuit Breaker pattern for external API calls
 * Prevents cascading failures by failing fast when API is down
 */
class CircuitBreaker {
  constructor(name, fn, { threshold = 5, timeout = 60000, halfOpenRequests = 1 } = {}) {
    this.name = name;
    this.fn = fn;
    this.threshold = threshold; // Fail count to open circuit
    this.timeout = timeout; // Ms before trying half-open
    this.halfOpenRequests = halfOpenRequests;

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();

    this.stats = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      openCount: 0,
    };
  }

  async execute(...args) {
    this.stats.totalRequests++;

    // If circuit is open, check if we should try half-open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.stats.openCount++;
        const secondsLeft = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        throw new Error(
          `Circuit breaker OPEN for ${this.name} (${secondsLeft}s remaining)`
        );
      }

      this.state = 'HALF_OPEN';
      console.log(`🔄 Circuit breaker ${this.name} HALF_OPEN, attempting recovery...`);
    }

    try {
      const result = await this.fn(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failCount = 0;
    this.stats.successCount++;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenRequests) {
        this.state = 'CLOSED';
        this.successCount = 0;
        console.log(`✅ Circuit breaker ${this.name} CLOSED, recovered!`);
      }
    }
  }

  onFailure() {
    this.failCount++;
    this.stats.failureCount++;

    if (this.failCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.error(
        `🔴 Circuit breaker ${this.name} OPEN! ` +
        `Failing requests for ${Math.round(this.timeout / 1000)}s`
      );
    } else {
      console.warn(
        `⚠️  ${this.name}: fail count ${this.failCount}/${this.threshold}`
      );
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failCount: this.failCount,
      nextAttempt: this.nextAttempt,
      stats: this.stats,
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failCount = 0;
    this.successCount = 0;
  }
}

module.exports = { CircuitBreaker };
