/**
 * Rate limiter using token bucket algorithm
 * Tracks requests per minute and queues requests that exceed the limit
 */
export declare class RateLimiter {
    private maxRequests;
    private windowMs;
    private requests;
    private queue;
    private processingQueue;
    constructor(maxRequests: number, windowMs?: number);
    /**
     * Wait for permission to make a request
     * Returns a promise that resolves when the request can proceed
     */
    waitForPermission(): Promise<void>;
    /**
     * Process the queue of waiting requests
     */
    private processQueue;
    /**
     * Get current request count in the window
     */
    getCurrentCount(): number;
    /**
     * Get queue length
     */
    getQueueLength(): number;
}
export declare const openAIRateLimiter: RateLimiter;
//# sourceMappingURL=rateLimiter.d.ts.map