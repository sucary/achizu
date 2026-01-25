export interface Coordinates {
    lat: number;
    lng: number;
}

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
    importance: number;
    geojson?: {
        type: "MultiPolygon" | "Polygon";
        coordinates: number[][][][] | number[][][];
    };
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

export interface NominatimSearchResult {
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