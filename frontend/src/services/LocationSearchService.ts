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
}

type PendingSearch =
    | { type: 'text'; query: string; source: SearchSource }
    | { type: 'reverse'; lat: number; lng: number; source: SearchSource }
    | null;

const SEARCH_TIMEOUT_MS = 10000;

export class LocationSearchService {
    private abortController: AbortController | null = null;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private isSearching = false;
    private pendingSearch: PendingSearch = null;
    private callbacks: SearchCallbacks;

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
            console.warn('Search timed out after 10 seconds');
            this.abortController?.abort();
            this.abortController = null;
            this.isSearching = false;
            this.callbacks.onError('Search timed out. Please try again.');
        }, SEARCH_TIMEOUT_MS);
    }

    private async processQueue() {
        const pending = this.pendingSearch;
        if (!pending) {
            this.isSearching = false;
            return;
        }

        this.pendingSearch = null;

        if (pending.type === 'text') {
            await this.executeTextSearch(pending.query, pending.source);
        } else {
            await this.executeReverseSearch(pending.lat, pending.lng, pending.source);
        }
    }

    private async executeTextSearch(query: string, source: SearchSource) {
        this.isSearching = true;
        this.abortController = new AbortController();
        this.startTimeout();
        this.callbacks.onStart(source === 'nominatim');

        try {
            const response = await searchCities(query, 50, source, this.abortController.signal);
            this.clearTimeout();
            this.callbacks.onSuccess(response);
        } catch (err) {
            this.clearTimeout();
            if (axios.isCancel(err)) {
                this.isSearching = false;
                return;
            }
            this.callbacks.onError('Failed to search locations. Please try again.');
            console.error('Search failed:', err);
        }

        await this.processQueue();
    }

    private async executeReverseSearch(lat: number, lng: number, source: SearchSource) {
        this.isSearching = true;
        this.abortController = new AbortController();
        this.startTimeout();
        this.callbacks.onStart(source === 'nominatim');

        try {
            const response = await reverseSearchCities(lat, lng, 50, source, this.abortController.signal);
            this.clearTimeout();
            this.callbacks.onSuccess(response);
        } catch (err) {
            this.clearTimeout();
            if (axios.isCancel(err)) {
                this.isSearching = false;
                return;
            }
            this.callbacks.onError('Failed to search for more results.');
            console.error('Reverse search failed:', err);
        }

        await this.processQueue();
    }

    async search(query: string, source: SearchSource = 'auto') {
        if (this.isSearching) {
            this.pendingSearch = { type: 'text', query, source };
            return;
        }
        await this.executeTextSearch(query, source);
    }

    async reverseSearch(lat: number, lng: number, source: SearchSource = 'auto') {
        if (this.isSearching) {
            this.pendingSearch = { type: 'reverse', lat, lng, source };
            return;
        }
        await this.executeReverseSearch(lat, lng, source);
    }

    cancel() {
        this.clearTimeout();
        this.abortController?.abort();
        this.abortController = null;
        this.pendingSearch = null;
        this.isSearching = false;
    }

    get searching() {
        return this.isSearching;
    }

    destroy() {
        this.cancel();
    }
}
