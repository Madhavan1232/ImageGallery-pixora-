/**
 * Request pool for limiting concurrent API requests
 * Prevents overwhelming single core (Azure F1) with too many concurrent requests
 */
class RequestPool {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this.activeCount = 0;
    this.queue = [];
    this.stats = {
      totalRequests: 0,
      activeRequests: 0,
      queuedRequests: 0,
    };
  }

  async run(fn) {
    // Wait if at max capacity
    while (this.activeCount >= this.maxConcurrent) {
      await new Promise((resolve) => this.queue.push(resolve));
    }

    this.activeCount++;
    this.stats.activeRequests = this.activeCount;
    this.stats.totalRequests++;

    try {
      return await fn();
    } finally {
      this.activeCount--;
      this.stats.activeRequests = this.activeCount;

      // Process queued request
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
  }

  async runAll(fns) {
    this.stats.queuedRequests = fns.length;
    return Promise.allSettled(fns.map((fn) => this.run(fn)));
  }

  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
    };
  }

  clear() {
    this.queue = [];
    this.activeCount = 0;
  }
}

module.exports = { RequestPool };
