export interface Coordinates {
    lat: number;
    lng: number;
}

export interface City {
        id: string;
        name: string;
        province: string;
        country: string | null;
        boundary: {
            type: "MultiPolygon";
            coordinates: number[][][][];
        }; 
        center: Coordinates;
        osmId: string;
        lastUpdated: Date | string;
        needsRefresh: boolean;

}