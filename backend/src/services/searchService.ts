import { ArtistStore } from '../models/artistStore';
import { TextSearch } from './searchHelper';
import type { Artist, CropArea } from '../types/artist';

export interface ArtistSearchResult {
    type: 'artist';
    id: string;
    name: string;
    sourceImage?: string;
    avatarCrop?: CropArea;
    activeLocation: { city: string; province: string };
    coordinates: { lat: number; lng: number };
}

export interface LocationSearchResult {
    type: 'location';
    id?: string;
    displayName: string;
    locationType?: string;
    center: { lat: number; lng: number };
    isLocal?: boolean;
    osmId: number;
    osmType: string;
}

export interface UnifiedSearchResponse {
    artists: ArtistSearchResult[];
    locations: LocationSearchResult[];
    totalCount: number;
    locationSource: 'local' | 'nominatim' | 'cache';
    hasMoreLocations: boolean;
}

function mapArtistToSearchResult(artist: Artist): ArtistSearchResult {
    return {
        type: 'artist',
        id: artist.id,
        name: artist.name,
        sourceImage: artist.sourceImage,
        avatarCrop: artist.avatarCrop,
        activeLocation: {
            city: artist.activeLocation.city,
            province: artist.activeLocation.province,
        },
        coordinates: {
            lat: artist.activeLocation.coordinates.lat,
            lng: artist.activeLocation.coordinates.lng,
        },
    };
}

export const SearchService = {
    search: async (
        query: string,
        limit: number = 10,
        source: 'auto' | 'nominatim' = 'auto'
    ): Promise<UnifiedSearchResponse> => {
        // Execute all searches in parallel
        const [artists, locationResponse] = await Promise.all([
            ArtistStore.getAll({ name: query }),
            TextSearch.search(query, limit, source),
        ]);

        const artistResults: ArtistSearchResult[] = artists
            .slice(0, limit)
            .map(mapArtistToSearchResult);

        const locationResults: LocationSearchResult[] = locationResponse.results
            .slice(0, limit)
            .map((loc) => {
                const r = loc as Record<string, unknown>;
                const center = r.center as { lat: number; lng: number } | undefined;

                return {
                    type: 'location' as const,
                    id: loc.id,
                    displayName: (r.displayName as string) || (r.name as string) || 'Unknown',
                    locationType: r.type as string | undefined,
                    center: {
                        lat: (r.lat as number) ?? center?.lat ?? 0,
                        lng: (r.lng as number) ?? center?.lng ?? 0,
                    },
                    isLocal: loc.isLocal,
                    osmId: loc.osmId,
                    osmType: loc.osmType,
                };
            });

        return {
            artists: artistResults,
            locations: locationResults,
            totalCount: artistResults.length + locationResults.length,
            locationSource: locationResponse.source,
            hasMoreLocations: locationResponse.hasMore,
        };
    },
};
