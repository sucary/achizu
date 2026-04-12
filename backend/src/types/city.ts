export interface Coordinates {
    lat: number;
    lng: number;
}

// GeoJSON geometry types from Nominatim
export type GeoJSONGeometry =
    | { type: "Point"; coordinates: [number, number] }
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };

export interface City {
    id: string;
    name: string;
    province: string;
    country: string | null;
    displayName?: string;
    boundary?: {
        type: "MultiPolygon";
        coordinates: number[][][][];
    };
    rawBoundary?: {
        type: "MultiPolygon" | "Polygon";
        coordinates: number[][][][] | number[][][];
    };
    center: Coordinates;
    osmId: number;
    osmType: string;
    type?: string;
    class?: string;
    importance?: number;
    boundingBox?: number[];
    lastUpdated?: Date | string;
    needsRefresh?: boolean;
    isPriority?: boolean;
}

export interface NominatimResponse {
    place_id: number;
    licence: string;
    osm_type: string;
    osm_id: number;
    boundingbox: string[];
    lat: string;
    lon: string;
    name?: string;
    display_name: string;
    class: string;
    type: string;
    addresstype?: string;
    importance: number;
    geojson?: GeoJSONGeometry;
    address?: {
        city?: string;
        administrative?: string;
        town?: string;
        village?: string;
        state?: string;
        province?: string;
        region?: string;
        country?: string;
        country_code?: string;
        [key: string]: string | undefined;
    };
}

/**
 * Multilingual name set for a location
 */
export interface LocalizedNames {
    en?: string;
    zhHans?: string;
    zhHant?: string;
    ja?: string;
    native?: string;
}

/**
 * Full localized address chain for a location
 */
export interface LocalizedChain {
    city: LocalizedNames;
    province?: LocalizedNames;
    country?: LocalizedNames;
}

/**
 * The location chain with osmId
 */
export interface LocalizedLocation {
    id: string;
    chain: LocalizedChain;
}

export interface NominatimSearchResult {
    name: string;
    displayName: string;
    osmId: number;
    osmType: string;
    lat: number;
    lng: number;
    type: string;
    class: string;
    importance: number;
    address?: Record<string, string>;
    boundingBox: number[];
}