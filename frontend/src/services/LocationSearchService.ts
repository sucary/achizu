import axios from 'axios';
import { searchCities, reverseSearchCities, type SearchResult } from './api';

type SearchSource = 'auto' | 'nominatim';

interface SearchResponse {
    results: SearchResult[];
    source: 'local' | 'nominatim' | 'cache';
    hasMore: boolean;
}

interface SearchCallbacks {
    onStart: (isMore: boolean) => void;
    onSuccess: (response: SearchResponse) => void;
    onError: (error: string) => void;
    onQueueUpdate?: (queueSize: number) => void;
    onRateLimited?: (retryFn: () => void) => void;
}

type PendingSearch =
    | { type: 'text'; query: string; source: SearchSource }
    | { type: 'reverse'; lat: number; lng: number; source: SearchSource };

const SEARCH_TIMEOUT_MS = 10000;

export class LocationSearchService {
    private abortController: AbortController | null = null;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private isSearching = false;
    private pendingSearch: PendingSearch | null = null;
    private callbacks: SearchCallbacks;
    private lastSearchStartTime = 0;
    private readonly RATE_LIMIT_MS = 1000; // 1 second between searches

    constructor(callbacks: SearchCallbacks) {
        this.callbacks = callbacks;
    }

    private clearTimeout() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    private startTimeout() {
        this.clearTimeout();
        this.timeoutId = setTimeout(() => {
            console.warn('[LocationSearch] Search timed out after 10 seconds');
            this.abortController?.abort();
            this.abortController = null;
            this.isSearching = false;
            this.callbacks.onError('Search timed out. Please try again.');
        }, SEARCH_TIMEOUT_MS);
    }

    private async processQueue(hasResults: boolean = false) {
        // If we got results, clear the pending search - user already found what they need
        if (hasResults && this.pendingSearch) {
            this.pendingSearch = null;
            this.isSearching = false;
            this.callbacks.onQueueUpdate?.(0);
            console.log(`[LocationSearch] Results found - cleared pending search`);
            return;
        }

        const pending = this.pendingSearch;
        this.pendingSearch = null;
        this.callbacks.onQueueUpdate?.(0);

        if (!pending) {
            this.isSearching = false;
            console.log('[LocationSearch] Queue empty, stopping');
            return;
        }

        if (pending.type === 'text') {
            console.log('[LocationSearch] Processing pending text search:', pending.query);
            await this.executeTextSearch(pending.query, pending.source);
        } else {
            console.log('[LocationSearch] Processing pending reverse search:', pending.lat, pending.lng);
            await this.executeReverseSearch(pending.lat, pending.lng, pending.source);
        }
    }

    private async executeTextSearch(query: string, source: SearchSource) {
        this.isSearching = true;
        this.lastSearchStartTime = Date.now();
        this.abortController = new AbortController();
        this.startTimeout();
        console.log('[LocationSearch] Starting text search:', query, 'source:', source);
        this.callbacks.onStart(source === 'nominatim');

        try {
            const response = await searchCities(query, 50, source, this.abortController.signal);
            this.clearTimeout();
            this.callbacks.onSuccess(response);

            // Pause queue if we got results
            await this.processQueue(response.results.length > 0);
        } catch (err) {
            this.clearTimeout();
            if (axios.isCancel(err)) {
                console.log('[LocationSearch] Search cancelled, processing queue...');
                await this.processQueue(false);
                return;
            }

            // Extract error message from API response
            let errorMessage = 'Failed to search locations. Please try again.';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMessage = err.response.data.error;
            }

            console.error('Failed to search cities:', err);
            this.callbacks.onError(errorMessage);

            // Continue queue without pause on error
            await this.processQueue(false);
        }
    }

    private async executeReverseSearch(lat: number, lng: number, source: SearchSource) {
        this.isSearching = true;
        this.lastSearchStartTime = Date.now();
        this.abortController = new AbortController();
        this.startTimeout();
        console.log('[LocationSearch] Starting reverse search:', lat, lng, 'source:', source);
        this.callbacks.onStart(source === 'nominatim');

        try {
            const response = await reverseSearchCities(lat, lng, 50, source, this.abortController.signal);
            this.clearTimeout();
            this.callbacks.onSuccess(response);

            // Pause queue if we got results
            await this.processQueue(response.results.length > 0);
        } catch (err) {
            this.clearTimeout();
            if (axios.isCancel(err)) {
                console.log('[LocationSearch] Reverse search cancelled, processing queue...');
                await this.processQueue(false);
                return;
            }

            // Extract error message from API response
            let errorMessage = 'Failed to search for more results.';
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                errorMessage = err.response.data.error;
            }

            console.error('Search failed:', err);
            this.callbacks.onError(errorMessage);

            // Continue queue without pause on error
            await this.processQueue(false);
        }
    }

    async search(query: string, source: SearchSource = 'auto', bypassRateLimit = false) {
        // Check rate limit (unless bypassed for retry)
        if (!bypassRateLimit && this.lastSearchStartTime > 0) {
            const timeSinceLastSearch = Date.now() - this.lastSearchStartTime;
            if (timeSinceLastSearch < this.RATE_LIMIT_MS) {
                console.log('[LocationSearch] Rate limited, showing retry option');
                this.callbacks.onRateLimited?.(() => this.search(query, source, true));
                return;
            }
        }

        if (this.isSearching) {
            this.pendingSearch = { type: 'text', query, source };
            this.callbacks.onQueueUpdate?.(1);
            console.log('[LocationSearch] Already searching, queuing text search:', query);
            return;
        }
        await this.executeTextSearch(query, source);
    }

    async reverseSearch(lat: number, lng: number, source: SearchSource = 'auto', bypassRateLimit = false) {
        // Check rate limit (unless bypassed for retry)
        if (!bypassRateLimit && this.lastSearchStartTime > 0) {
            const timeSinceLastSearch = Date.now() - this.lastSearchStartTime;
            if (timeSinceLastSearch < this.RATE_LIMIT_MS) {
                console.log('[LocationSearch] Rate limited, showing retry option');
                this.callbacks.onRateLimited?.(() => this.reverseSearch(lat, lng, source, true));
                return;
            }
        }

        if (this.isSearching) {
            this.pendingSearch = { type: 'reverse', lat, lng, source };
            this.callbacks.onQueueUpdate?.(1);
            console.log('[LocationSearch] Already searching, queuing reverse search:', lat, lng);
            return;
        }
        await this.executeReverseSearch(lat, lng, source);
    }

    cancel() {
        const hadPending = this.pendingSearch !== null;

        this.clearTimeout();
        this.abortController?.abort();
        this.abortController = null;
        this.pendingSearch = null;
        this.isSearching = false;

        // Notify UI that queue was cleared
        this.callbacks.onQueueUpdate?.(0);

        if (hadPending) {
            console.log(`[LocationSearch] Cancelled - cleared pending search`);
        }
    }

    get searching() {
        return this.isSearching;
    }

    get queueSize() {
        return this.pendingSearch ? 1 : 0;
    }

    destroy() {
        this.cancel();
    }
}
