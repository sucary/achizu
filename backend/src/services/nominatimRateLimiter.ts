/**
 * Global rate limiter for Nominatim API calls
 * Nominatim usage policy: Max 1 request per second across the entire application
 * This ensures we don't exceed their rate limit even with multiple concurrent users
 */

interface QueuedRequest {
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

class NominatimRateLimiter {
    private queue: QueuedRequest[] = [];
    private processing = false;
    private lastRequestTime = 0;
    private readonly MIN_INTERVAL_MS = 1000; // 1 second between requests

    /**
     * Add a Nominatim API call to the global queue
     * Returns a promise that resolves when the request completes
     */
    async enqueue<T>(requestFn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({
                execute: requestFn,
                resolve,
                reject
            });

            console.log(`[NOMINATIM-LIMITER] Request queued (queue size: ${this.queue.length})`);

            // Start processing if not already running
            if (!this.processing) {
                this.processQueue();
            }
        });
    }

    private async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift();
            if (!request) break;

            // Wait if we need to respect rate limit
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;

            if (timeSinceLastRequest < this.MIN_INTERVAL_MS) {
                const waitTime = this.MIN_INTERVAL_MS - timeSinceLastRequest;
                console.log(`[NOMINATIM-LIMITER] Rate limiting: waiting ${waitTime}ms before next request`);
                await this.sleep(waitTime);
            }

            // Execute the request
            try {
                this.lastRequestTime = Date.now();
                const result = await request.execute();
                request.resolve(result);
            } catch (error) {
                request.reject(error);
            }
        }

        this.processing = false;
        console.log('[NOMINATIM-LIMITER] Queue empty, stopping');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current queue size (for monitoring)
     */
    getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * Clear the queue (for cleanup/emergencies)
     */
    clearQueue(): void {
        this.queue.forEach(req => req.reject(new Error('Queue cleared')));
        this.queue = [];
    }
}

// Export singleton instance
export const nominatimLimiter = new NominatimRateLimiter();
