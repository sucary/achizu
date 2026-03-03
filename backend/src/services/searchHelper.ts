import { CityService } from './cityService';
import { SearchCacheService } from './searchCacheService';

export interface SearchResult {
    osmId: number;
    osmType: string;
    isLocal: boolean;
    id?: string;
    clickedCoordinates?: { lat: number; lng: number };
    [key: string]: unknown;
}

export interface SearchResponse {
    results: SearchResult[];
    source: 'local' | 'nominatim' | 'cache';
    hasMore: boolean;
}

/**
 * Deduplicate results by osmId:osmType key
 */
export function deduplicateResults<T extends { osmId: number; osmType: string }>(
    results: T[]
): T[] {
    const seen = new Set<string>();
    const unique: T[] = [];

    for (const result of results) {
        const key = `${String(result.osmId)}:${result.osmType}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(result);
        }
    }

    return unique;
}

/**
 * Text search helpers
 */
export const TextSearch = {
    async getLocalResults(query: string, limit: number): Promise<SearchResult[]> {
        const [priorityResults, localResults] = await Promise.all([
            CityService.getPriorityLocations(query),
            CityService.searchLocal(query, limit)
        ]);

        const combined = [
            ...priorityResults.map(r => ({ ...r, isLocal: true })),
            ...localResults.map(r => ({ ...r, isLocal: true }))
        ];

        return deduplicateResults(combined);
    },

    async getNominatimResults(query: string, limit: number): Promise<{ results: SearchResult[]; fromCache: boolean }> {
        let results = await SearchCacheService.get(query);
        let fromCache = true;

        if (!results) {
            fromCache = false;
            results = await CityService.searchNominatim(query, limit);

            // Cache the results (fire-and-forget)
            SearchCacheService.set(query, results).catch(err => {
                console.error('Failed to cache search results:', err);
            });
        }

        // Cross-reference with local DB to set isLocal flag
        const osmPairs = results.map(r => ({ osmId: r.osmId, osmType: r.osmType }));
        const existingMap = await CityService.getExistingOsmIds(osmPairs);

        const withFlags = results.map(r => {
            const key = `${String(r.osmId)}:${r.osmType}`;
            return {
                ...r,
                id: existingMap.get(key),
                isLocal: existingMap.has(key)
            };
        });

        return { results: withFlags, fromCache };
    },

    async search(query: string, limit: number, source: 'auto' | 'local' | 'nominatim'): Promise<SearchResponse> {
        if (source === 'local') {
            const localResults = await this.getLocalResults(query, limit);
            return {
                results: localResults.slice(0, limit),
                source: 'local',
                hasMore: true
            };
        }

        if (source === 'nominatim') {
            const [localResults, nominatimData] = await Promise.all([
                this.getLocalResults(query, limit),
                this.getNominatimResults(query, limit)
            ]);

            const combined = deduplicateResults([...localResults, ...nominatimData.results]);

            return {
                results: combined.slice(0, limit),
                source: nominatimData.fromCache ? 'cache' : 'nominatim',
                hasMore: false
            };
        }

        // AUTO: Local first, Nominatim if empty
        const localResults = await this.getLocalResults(query, limit);

        if (localResults.length > 0) {
            // Show "more" if not cached OR if cache has more results than local
            const cachedCount = await SearchCacheService.getResultCount(query);
            const hasMore = cachedCount === null || cachedCount > localResults.length;

            return {
                results: localResults.slice(0, limit),
                source: 'local',
                hasMore
            };
        }

        const nominatimData = await this.getNominatimResults(query, limit);
        return {
            results: nominatimData.results.slice(0, limit),
            source: nominatimData.fromCache ? 'cache' : 'nominatim',
            hasMore: false
        };
    }
};

/**
 * Reverse search helpers
 */
export const ReverseSearch = {
    async getLocalResults(lat: number, lng: number, limit: number): Promise<SearchResult[]> {
        const localResults = await CityService.reverseGeocodeAll(lat, lng, limit);
        return localResults.map(r => ({
            ...r,
            isLocal: true,
            clickedCoordinates: { lat, lng }
        }));
    },

    async getNominatimResult(lat: number, lng: number): Promise<SearchResult | null> {
        const result = await CityService.reverseGeocode(lat, lng);

        if (result) {
            // Fetch and save full boundary data (fire-and-forget)
            CityService.fetchByOsmId(result.osmId, result.osmType)
                .then(fullData => {
                    if (fullData) {
                        return CityService.saveFromNominatim(fullData);
                    }
                })
                .catch(() => {});

            return {
                ...result,
                isLocal: false,
                clickedCoordinates: { lat, lng }
            };
        }

        return null;
    },

    async search(lat: number, lng: number, limit: number, source: 'auto' | 'nominatim'): Promise<SearchResponse> {
        if (source === 'nominatim') {
            const [localResults, nominatimResult] = await Promise.all([
                this.getLocalResults(lat, lng, limit),
                this.getNominatimResult(lat, lng)
            ]);

            const allResults = nominatimResult
                ? [...localResults, nominatimResult]
                : localResults;

            return {
                results: deduplicateResults(allResults).slice(0, limit),
                source: 'nominatim',
                hasMore: false
            };
        }

        // AUTO: Local first, Nominatim if empty
        const localResults = await this.getLocalResults(lat, lng, limit);

        if (localResults.length > 0) {
            return {
                results: localResults,
                source: 'local',
                hasMore: false
            };
        }

        const nominatimResult = await this.getNominatimResult(lat, lng);

        if (nominatimResult) {
            return {
                results: [nominatimResult],
                source: 'nominatim',
                hasMore: false
            };
        }

        return {
            results: [],
            source: 'local',
            hasMore: false
        };
    }
};
