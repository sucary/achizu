/**
 * Geographic coordinates for a location
 */
export interface Coordinates {
    lat: number;
    lng: number;
}

/**
 * Location information including city, province, and coordinates
 */
export interface Location {
    city: string;
    province: string;
    coordinates: Coordinates;   // For determining the city, not for locating the artist
    osmId?: number;
    osmType?: string;
}

/**
 * Social media links for an artist
 */
export interface SocialLinks {
    instagram?: string;
    twitter?: string;
    spotify?: string;
    website?: string;
    youtube?: string;
}

/**
 * Complete artist profile
 */
export interface Artist {
    id: string;
    name: string;
    profilePicture?: string; // currently avatar and background image together
    originalLocation: Location; // Where artist is from
    activeLocation: Location; // Where artist is currently based
    socialLinks?: SocialLinks;
    createdAt: Date | string;
    updatedAt: Date | string;
    originalLocationDisplayCoordinates: Coordinates;
    activeLocationDisplayCoordinates: Coordinates;
    originalCityId: string;
    activeCityId: string;
}

/**
 * Artist data for creation (without auto-generated fields)
 */
export interface CreateArtistDTO {
    name: string;
    profilePicture?: string;
    originalLocation: Location;
    activeLocation: Location;
    socialLinks?: SocialLinks;
}

/**
 * Extended DTO for Store layer including resolved IDs and coordinates
 */
export interface StoreArtistDTO extends CreateArtistDTO {
    originalCityId: string;
    activeCityId: string;
    originalLocationDisplayCoordinates: Coordinates;
    activeLocationDisplayCoordinates: Coordinates;
}

/**
 * Artist data for updates (all fields optional except those needed for validation)
 */
export interface UpdateArtistDTO {
    name?: string;
    profilePicture?: string;
    originalLocation?: Location;
    activeLocation?: Location;
    socialLinks?: SocialLinks;
}

/**
 * Extended Update DTO for Store layer
 */
export interface UpdateStoreArtistDTO extends UpdateArtistDTO {
    originalCityId?: string;
    activeCityId?: string;
    originalLocationDisplayCoordinates?: Coordinates;
    activeLocationDisplayCoordinates?: Coordinates;
}

/**
 * Type for location view toggle (used in frontend)
 */
export type LocationView = 'original' | 'active';

/**
 * Query parameters for filtering artists
 */
export interface ArtistQueryParams {
    name?: string;
    city?: string;
    province?: string;
    view?: LocationView; // Which location to search by
}

/**
 * Count of artists per location (city or province)
 */
export interface LocationCount {
    location: string;
    count: number;
}