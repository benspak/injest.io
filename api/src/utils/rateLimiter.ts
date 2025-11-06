/**
 * Rate limiter using token bucket algorithm
 * Tracks requests per minute and queues requests that exceed the limit
 */
export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[] = [];
  private queue: Array<{ resolve: () => void; timestamp: number }> = [];
  private processingQueue: boolean = false;

  constructor(maxRequests: number, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Wait for permission to make a request
   * Returns a promise that resolves when the request can proceed
   */
  async waitForPermission(): Promise<void> {
    const now = Date.now();

    // Clean up old requests outside the window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);

    // If we're under the limit, proceed immediately
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return;
    }

    // Otherwise, we need to wait
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve, timestamp: now });
      this.processQueue();
    });
  }

  /**
   * Process the queue of waiting requests
   */
  private async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    while (this.queue.length > 0) {
      const now = Date.now();

      // Clean up old requests
      this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);

      // If we have space, process the next request
      if (this.requests.length < this.maxRequests) {
        const next = this.queue.shift();
        if (next) {
          this.requests.push(now);
          next.resolve();
        }
      } else {
        // Calculate when the oldest request will expire
        const oldestRequest = this.requests[0];
        const waitTime = this.windowMs - (now - oldestRequest) + 10; // Add 10ms buffer

        // Wait until we can process the next request
        await new Promise(resolve => setTimeout(resolve, Math.max(0, waitTime)));
      }
    }

    this.processingQueue = false;
  }

  /**
   * Get current request count in the window
   */
  getCurrentCount(): number {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    return this.requests.length;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

// Create a singleton rate limiter for OpenAI (500 requests per minute)
export const openAIRateLimiter = new RateLimiter(500, 60000);
