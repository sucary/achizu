import type { CropArea } from './artist';

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

export interface UserSearchResult {
    type: 'user';
    id: string;
    username: string;
}

export type SearchResult = ArtistSearchResult | LocationSearchResult | UserSearchResult;

export interface MainSearchResponse {
    artists: ArtistSearchResult[];
    locations: LocationSearchResult[];
    users: UserSearchResult[];
    totalCount: number;
    locationSource: 'local' | 'nominatim' | 'cache';
    hasMoreLocations: boolean;
}
