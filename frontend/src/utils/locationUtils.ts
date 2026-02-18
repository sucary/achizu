import type { SearchResult } from '../services/api';

export interface ExtractedLocation {
    city: string;
    province: string;
    country: string;
    coordinates: { lat: number; lng: number };
    displayName: string;
    osmId?: number;
    osmType?: string;
}

interface AddressFields {
    city?: string;
    locality?: string;
    town?: string;
    village?: string;
    province?: string;
    state?: string;
    country?: string;
}

/**
 * Extracts and normalizes location data from a Nominatim search result.
 * Handles edge cases like ISO province codes (e.g., JP-13) and missing fields.
 */
export const extractLocationData = (result: SearchResult): ExtractedLocation => {
    // Nominatim search results return lat/lng as top-level fields instead of a center object
    const raw = result as unknown as { lat?: number; lng?: number; address?: AddressFields };
    const coordinates = result.center ?? (raw.lat != null && raw.lng != null
        ? { lat: raw.lat, lng: raw.lng }
        : { lat: 0, lng: 0 });
    const address = raw.address || {};

    let city = result.name || address.city || address.locality || address.town || address.village || '';
    let province = result.province || address.province || address.state || '';
    const country = result.country || address.country || '';

    // If province is empty or is an ISO code (like JP-13), extract from displayName
    if (!province || province.match(/^[A-Z]{2}-\d+$/)) {
        province = extractProvinceFromDisplayName(result.displayName);
    }

    // Fallback: if one is missing, use the other
    if (!city && province) city = province;
    if (city && !province) province = city;

    return {
        city,
        province,
        country,
        coordinates,
        displayName: result.displayName,
        osmId: result.osmId,
        osmType: result.osmType
    };
};

/**
 * Attempts to extract a province/state name from a comma-separated display name.
 * Skips numeric values (postal codes) and returns the most likely province segment.
 */
const extractProvinceFromDisplayName = (displayName: string): string => {
    const parts = displayName.split(',').map(p => p.trim());

    if (parts.length < 2) return '';

    // Walk backwards from second-to-last, skip postal codes
    for (let i = parts.length - 2; i >= 0; i--) {
        const part = parts[i];
        // Skip if starts with digit or contains 3+ consecutive digits (postal code)
        if (!part.match(/^\d/) && !part.match(/\d{3,}/)) {
            return part;
        }
    }

    // Fallback to second-to-last segment
    return parts[parts.length - 2];
};

/**
 * Creates an empty location object with zeroed coordinates.
 */
export const createEmptyLocation = () => ({
    city: '',
    province: '',
    coordinates: { lat: 0, lng: 0 }
});

/**
 * Checks if a location has valid (non-zero) coordinates.
 */
export const hasValidCoordinates = (location?: { coordinates?: { lat: number; lng: number } }): boolean => {
    if (!location?.coordinates) return false;
    return !(location.coordinates.lat === 0 && location.coordinates.lng === 0);
};
