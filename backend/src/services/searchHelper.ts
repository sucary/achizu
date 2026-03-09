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

        // Filter out uninformative "yes" types (from OSM boolean tags like bridge=yes)
        const filtered = results.filter(r => (r.type as string)?.toLowerCase() !== 'yes');

        // Cross-reference with local DB to set isLocal flag
        const osmPairs = filtered.map(r => ({ osmId: r.osmId, osmType: r.osmType }));
        const existingMap = await CityService.getExistingOsmIds(osmPairs);

        const withFlags = filtered.map(r => {
            const key = `${String(r.osmId)}:${r.osmType}`;
            const isLocal = existingMap.has(key);

            return {
                ...r,
                id: existingMap.get(key),
                isLocal
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

    async getOverpassResults(lat: number, lng: number): Promise<SearchResult[]> {
        // Get all administrative boundaries containing this point in ONE call
        const boundaries = await CityService.getContainingBoundaries(lat, lng);

        // If Overpass failed, fall back to Nominatim reverse geocode
        if (boundaries.length === 0) {
            const nominatimResult = await CityService.reverseGeocodeNominatim(lat, lng);
            if (nominatimResult) {
                // Fetch and save boundary data
                CityService.fetchByOsmId(nominatimResult.osmId, nominatimResult.osmType)
                    .then(fullData => {
                        if (fullData) return CityService.saveFromNominatim(fullData);
                    })
                    .catch(() => {});

                return [{
                    ...nominatimResult,
                    isLocal: false,
                    clickedCoordinates: { lat, lng }
                }];
            }
            return [];
        }

        // Convert to SearchResult format and save boundaries to DB
        const results: SearchResult[] = [];

        for (const boundary of boundaries) {
            results.push({
                ...boundary,
                isLocal: false,
                clickedCoordinates: { lat, lng }
            });

            // Fetch and save full boundary polygon data (fire-and-forget)
            CityService.fetchByOsmId(boundary.osmId, boundary.osmType)
                .then(fullData => {
                    if (fullData) {
                        return CityService.saveFromNominatim(fullData);
                    }
                })
                .catch(() => {});
        }

        return results;
    },

    async search(lat: number, lng: number, limit: number, source: 'auto' | 'nominatim'): Promise<SearchResponse> {
        // Get local results (from DB) and Overpass results (all admin boundaries) in parallel
        const [localResults, overpassResults] = await Promise.all([
            this.getLocalResults(lat, lng, limit),
            this.getOverpassResults(lat, lng)
        ]);

        const allResults = [...localResults, ...overpassResults];
        const deduplicated = deduplicateResults(allResults).slice(0, limit);

        if (deduplicated.length > 0) {
            return {
                results: deduplicated,
                source: overpassResults.length > 0 ? 'nominatim' : 'local',
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
