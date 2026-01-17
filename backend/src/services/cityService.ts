import pool from '../config/database';
import { City } from '../types/city';

interface NominatimResponse {
    place_id: number;
    licence: string;
    osm_type: string;
    osm_id: number;
    boundingbox: string[];
    lat: string;
    lon: string;
    display_name: string;
    class: string;
    type: string;
    importance: number;
    geojson: {
        type: "MultiPolygon" | "Polygon";
        coordinates: number[][][][];
    };
    address?: {
        country?: string;
        country_code?: string;
        [key: string]: string | undefined;
    };
}

export const CityService = {
    /**
     * Get city data, fetching from Nominatim if not in DB
     */
    getCity: async (name: string, province: string): Promise<City> => {
        // 1. Check DB
        const existingCity = await CityService.getFromDb(name, province);
        if (existingCity) {
            return existingCity;
        }

        // 2. Fetch from Nominatim
        const nominatimData = await CityService.fetchFromNominatim(name, province);
        if (!nominatimData) {
            throw new Error(`City not found: ${name}, ${province}`);
        }

        // 3. Save to DB and return
        return await CityService.saveToDb(name, province, nominatimData);
    },

    /**
     * Fetch city data from DB
     */
    getFromDb: async (name: string, province: string): Promise<City | null> => {
        const result = await pool.query(`
            SELECT 
                id, name, province, country,
                ST_AsGeoJSON(boundary)::json as boundary,
                ST_Y(center::geometry) as lat,
                ST_X(center::geometry) as lng,
                osm_id, last_updated, needs_refresh
            FROM city_boundaries
            WHERE name = $1 AND province = $2
        `, [name, province]);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            boundary: row.boundary,
            center: { lat: row.lat, lng: row.lng },
            osmId: row.osm_id,
            lastUpdated: row.last_updated,
            needsRefresh: row.needs_refresh
        };
    },

    /**
     * Fetch from Nominatim API
     */
    fetchFromNominatim: async (city: string, state: string): Promise<NominatimResponse | null> => {
        const params = new URLSearchParams({
            city: city,
            state: state,
            format: 'json',
            polygon_geojson: '1',
            addressdetails: '1',
            limit: '1'
        });

        const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
        
        try {
            // User-Agent is required by Nominatim TOS
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'ArtistLocationMap/1.0' 
                }
            });

            if (!response.ok) {
                throw new Error(`Nominatim API error: ${response.statusText}`);
            }

            const data = await response.json() as NominatimResponse[];
            return data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('Error fetching from Nominatim:', error);
            return null;
        }
    },

    /**
     * Save new city to DB
     */
    saveToDb: async (name: string, province: string, data: NominatimResponse): Promise<City> => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const geojson = data.geojson.type === 'Polygon' 
                ? { type: 'MultiPolygon', coordinates: [data.geojson.coordinates] }
                : data.geojson;

            const country = data.address?.country || 'Unknown';

            const result = await client.query(`
                INSERT INTO city_boundaries (
                    name, province, country,
                    boundary, center, osm_id
                ) VALUES (
                    $1, $2, $3,
                    ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography,
                    ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                    $7
                )
                RETURNING
                    id, name, province, country,
                    ST_AsGeoJSON(boundary)::json as boundary,
                    ST_Y(center::geometry) as lat,
                    ST_X(center::geometry) as lng,
                    osm_id, last_updated, needs_refresh
            `, [
                name,
                province,
                country,
                JSON.stringify(geojson),
                parseFloat(data.lon),
                parseFloat(data.lat),
                data.osm_id
            ]);

            await client.query('COMMIT');

            const row = result.rows[0];
            return {
                id: row.id,
                name: row.name,
                province: row.province,
                country: row.country,
                boundary: row.boundary,
                center: { lat: row.lat, lng: row.lng },
                osmId: row.osm_id,
                lastUpdated: row.last_updated,
                needsRefresh: row.needs_refresh
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error saving city to DB:', error);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Generate a random point within the city boundary
     */
    generateRandomPoint: async (cityId: string): Promise<{lat: number, lng: number} | null> => {
        const result = await pool.query(`
            SELECT
                ST_Y(ST_GeometryN(point, 1)) as lat,
                ST_X(ST_GeometryN(point, 1)) as lng
            FROM (
                SELECT ST_GeneratePoints(boundary::geometry, 1) as point
                FROM city_boundaries
                WHERE id = $1
            ) as generated
        `, [cityId]);

        if (result.rows.length === 0) return null;
        
        return {
            lat: result.rows[0].lat,
            lng: result.rows[0].lng
        };
    }
};