import pool from '../config/database';
import { City, NominatimResponse, NominatimSearchResult } from '../types/city';

/**
 * Get display type for a location
 */
function getDisplayType(type: string, addresstype?: string): string {
    return type === 'administrative' && addresstype ? addresstype : type;
}

export const CityService = {

    /**
     * Search cities in local DB with fuzzy matching
     */
    searchLocal: async (query: string, limit: number = 20): Promise<City[]> => {
        const result = await pool.query(`
            SELECT
                id, name, province, country, display_name,
                osm_id, osm_type, type, class, importance,
                ST_Y(center::geometry) as lat,
                ST_X(center::geometry) as lng
            FROM city_boundaries
            WHERE
                name IS NOT NULL AND name != ''
                AND center IS NOT NULL
                AND (
                    name ILIKE $1
                    OR province ILIKE $1
                    OR display_name ILIKE $1
                )
            ORDER BY
                ST_Area(boundary::geometry) DESC,
                importance DESC NULLS LAST
            LIMIT $2
        `, [`%${query}%`, limit]);

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            displayName: row.display_name,
            center: { lat: row.lat, lng: row.lng },
            osmId: parseInt(row.osm_id),
            osmType: row.osm_type,
            type: row.type,
            class: row.class,
            importance: row.importance
        }));
    },

    /**
     * Get priority locations for a query
     */
    getPriorityLocations: async (query: string): Promise<City[]> => {
        const result = await pool.query(`
            SELECT
                cb.id,
                pl.name,
                pl.province,
                pl.country,
                pl.display_name,
                pl.osm_id,
                pl.osm_type,
                pl.lat,
                pl.lng,
                pl.rank,
                cb.type,
                cb.class,
                cb.importance
            FROM priority_locations pl
            LEFT JOIN city_boundaries cb ON cb.osm_id = pl.osm_id AND cb.osm_type = pl.osm_type
            WHERE pl.search_query = LOWER($1)
            ORDER BY pl.rank ASC
        `, [query]);

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            displayName: row.display_name,
            center: { lat: parseFloat(row.lat), lng: parseFloat(row.lng) },
            osmId: parseInt(row.osm_id),
            osmType: row.osm_type,
            type: row.type,
            class: row.class,
            importance: row.importance,
            isPriority: true
        }));
    },

    /**
     * Search cities via Nominatim API
     */
    searchNominatim: async (query: string, limit: number = 20): Promise<NominatimSearchResult[]> => {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            addressdetails: '1',
            limit: String(limit),
            polygon_geojson: '1',
            dedupe: '0'
        });

        const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
            });

            if (!response.ok) {
                throw new Error(`Nominatim API error: ${response.statusText}`);
            }

            const data = await response.json() as NominatimResponse[];

            // Save all results to city_boundaries in background instantly
            for (const item of data) {
                if (item.geojson) {
                    CityService.saveFromNominatim(item).catch(() => {
                    });
                }
            }

            return data.map(item => ({
                displayName: item.display_name,
                osmId: item.osm_id,
                osmType: item.osm_type,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: getDisplayType(item.type, item.addresstype),
                class: item.class,
                importance: item.importance,
                address: item.address as Record<string, string>,
                boundingBox: item.boundingbox.map(parseFloat)
            }));
        } catch (error) {
            console.error('Error searching Nominatim:', error);
            throw error;
        }
    },

    /**
     * Fetch city by OSM ID from DB
     */
    getByOsmId: async (osmId: number, osmType: string): Promise<City | null> => {
        const result = await pool.query(`
            SELECT
                id, name, province, country,
                display_name, osm_id, osm_type, type, class, importance,
                ST_AsGeoJSON(boundary)::json as boundary,
                ST_AsGeoJSON(raw_boundary)::json as raw_boundary,
                ST_Y(center::geometry) as lat,
                ST_X(center::geometry) as lng,
                last_updated, needs_refresh
            FROM city_boundaries
            WHERE osm_id = $1 AND osm_type = $2
        `, [osmId, osmType]);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            displayName: row.display_name,
            boundary: row.boundary,
            rawBoundary: row.raw_boundary,
            center: { lat: row.lat, lng: row.lng },
            osmId: parseInt(row.osm_id),
            osmType: row.osm_type,
            type: row.type,
            class: row.class,
            importance: row.importance,
            lastUpdated: row.last_updated,
            needsRefresh: row.needs_refresh
        };
    },

    /**
     * Check which OSM IDs already exist in local DB (for cross-referencing Nominatim results)
     */
    getExistingOsmIds: async (osmPairs: Array<{ osmId: number; osmType: string }>): Promise<Map<string, string>> => {
        if (osmPairs.length === 0) return new Map();

        const conditions = osmPairs.map((_, i) => `(osm_id = $${i * 2 + 1} AND osm_type = $${i * 2 + 2})`).join(' OR ');
        const params = osmPairs.flatMap(p => [String(p.osmId), p.osmType]);

        const result = await pool.query(`
            SELECT osm_id, osm_type, id FROM city_boundaries WHERE ${conditions}
        `, params);

        const map = new Map<string, string>();
        for (const row of result.rows) {
            map.set(`${String(row.osm_id)}:${row.osm_type}`, row.id);
        }
        return map;
    },

    /**
     * Fetch full city data from Nominatim by OSM ID (includes boundary)
     */
    fetchByOsmId: async (osmId: number, osmType: string): Promise<NominatimResponse | null> => {
        // Format: "R123" for relation, "W123" for way, "N123" for node
        const osmTypePrefix = osmType.charAt(0).toUpperCase();
        const osmIds = `${osmTypePrefix}${osmId}`;

        const params = new URLSearchParams({
            osm_ids: osmIds,
            format: 'json',
            polygon_geojson: '1',
            addressdetails: '1'
        });

        const url = `https://nominatim.openstreetmap.org/lookup?${params.toString()}`;

        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
            });

            if (!response.ok) {
                throw new Error(`Nominatim API error: ${response.statusText}`);
            }

            const data = await response.json() as NominatimResponse[];
            return data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('Error fetching from Nominatim by OSM ID:', error);
            return null;
        }
    },

    /**
     * Fetch a city with its polygon boundary from Nominatim
     */
    fetchCityWithBoundary: async (cityName: string, province: string, country: string): Promise<NominatimResponse | null> => {
        const query = [cityName, province, country].filter(Boolean).join(', ');
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            polygon_geojson: '1',
            addressdetails: '1',
            limit: '5'
        });

        const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
        console.log('Fetching parent city boundary:', url);

        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
            });

            if (!response.ok) {
                throw new Error(`Nominatim API error: ${response.statusText}`);
            }

            const data = await response.json() as NominatimResponse[];

            // Find a result that has a proper polygon boundary (not a Point)
            for (const result of data) {
                if (result.geojson && result.geojson.type !== 'Point') {
                    console.log('Found parent city with boundary:', result.display_name, result.geojson.type);
                    return result;
                }
            }

            console.log('No parent city with polygon boundary found');
            return null;
        } catch (error) {
            console.error('Error fetching city with boundary:', error);
            return null;
        }
    },

    /**
     * Save city from Nominatim data
     */
    saveFromNominatim: async (data: NominatimResponse): Promise<City> => {
        const geoType = data.geojson?.type ?? null;

        // For Point geometries, try to fetch the parent city's actual boundary
        if (geoType === 'Point') {
            const parentCityName = data.address?.city || data.address?.town || data.address?.village;
            if (parentCityName) {
                const parentProvince = data.address?.state || data.address?.province || data.address?.region || '';
                const parentCountry = data.address?.country || '';

                console.log(`Point geometry detected. Looking for parent city: ${parentCityName}, ${parentProvince}, ${parentCountry}`);

                const parentCityData = await CityService.fetchCityWithBoundary(parentCityName, parentProvince, parentCountry);
                if (parentCityData) {
                    console.log('Using parent city boundary instead of Point');
                    // Recursively save the parent city (which has a real boundary)
                    return await CityService.saveFromNominatim(parentCityData);
                }
            }
        }

        const city = data.address?.city
                  || data.address?.administrative
                  || data.address?.town
                  || data.address?.village
                  || data.name
                  || 'Unknown';

        // Extract province - try address fields first, then parse from displayName
        let province = data.address?.state || data.address?.province || data.address?.region;
        if (!province && data.display_name) {
            const parts = data.display_name.split(',').map(p => p.trim());
            const country = data.address?.country;
            if (parts.length >= 3 && country) {
                const countryIndex = parts.findIndex(p => p === country);
                if (countryIndex >= 2) {
                    for (let i = countryIndex - 1; i >= 0; i--) {
                        const part = parts[i];
                        if (!part.match(/^\d/) && !part.match(/\d{3,}/)) {
                            province = part;
                            break;
                        }
                    }
                }
            }
        }
        province = province || 'Unknown';
        const country = data.address?.country || 'Unknown';

        // Check if city already exists by name+province (to avoid unique constraint violation)
        const existingByName = await pool.query(`
            SELECT id, name, province, country, osm_id, osm_type,
                   ST_Y(center::geometry) as lat,
                   ST_X(center::geometry) as lng
            FROM city_boundaries
            WHERE name = $1 AND province = $2
            LIMIT 1
        `, [city, province]);

        if (existingByName.rows.length > 0) {
            const row = existingByName.rows[0];
            return {
                id: row.id,
                name: row.name,
                province: row.province,
                country: row.country,
                osmId: row.osm_id,
                osmType: row.osm_type,
                center: { lat: row.lat, lng: row.lng }
            };
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (!data.geojson) {
                throw new Error('No geojson data from Nominatim');
            }

            const geometry = data.geojson;
            const geometryType = geometry.type as string;

            // Skip unsupported geometry types (lines, etc.)
            if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
                throw new Error(`Unsupported geometry type: ${geometryType}`);
            }

            // Convert all geometries to MultiPolygon format for database consistency
            let geojson: { type: 'MultiPolygon'; coordinates: number[][][][] };

            if (geometry.type === 'Polygon') {
                // Wrap Polygon in MultiPolygon structure
                geojson = {
                    type: 'MultiPolygon',
                    coordinates: [geometry.coordinates]
                };
            } else if (geometry.type === 'Point') {
                // Fallback: create a small square polygon if no parent city found
                const [lng, lat] = geometry.coordinates;
                const offset = 0.001;
                geojson = {
                    type: 'MultiPolygon',
                    coordinates: [[[
                        [lng - offset, lat - offset],
                        [lng + offset, lat - offset],
                        [lng + offset, lat + offset],
                        [lng - offset, lat + offset],
                        [lng - offset, lat - offset]
                    ]]]
                };
            } else {
                // MultiPolygon - use as-is
                geojson = geometry;
            }

            console.log('Original geojson type:', geometry.type);
            console.log('Converted to:', geojson.type);
            console.log('Processed geojson:', JSON.stringify(geojson).substring(0, 200));

            const result = await client.query(`
                INSERT INTO city_boundaries (
                    name, province, country,
                    display_name, osm_id, osm_type, type, class, importance,
                    bounding_box, address_components,
                    boundary, raw_boundary, center
                ) VALUES (
                    $1, $2, $3,
                    $4, $5, $6, $7, $8, $9,
                    $10, $11,
                    ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($12)), 4326)::geography,
                    ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($12)), 4326)::geography,
                    ST_SetSRID(ST_MakePoint($13, $14), 4326)::geography
                )
                ON CONFLICT (osm_id, osm_type) DO UPDATE SET
                    type = EXCLUDED.type,
                    display_name = EXCLUDED.display_name,
                    last_updated = NOW()
                RETURNING id
            `, [
                city,
                province,
                country,
                data.display_name,
                data.osm_id,
                data.osm_type,
                getDisplayType(data.type, data.addresstype),
                data.class,
                data.importance,
                data.boundingbox,
                JSON.stringify(data.address),
                JSON.stringify(geojson),
                parseFloat(data.lon),
                parseFloat(data.lat)
            ]);

            const cityId = result.rows[0].id;

            // Remove ocean areas (existing logic)
            await client.query(`
                UPDATE city_boundaries
                SET
                    boundary = COALESCE(
                        ST_Multi(
                            ST_Difference(
                                boundary::geometry,
                                (
                                    SELECT ST_Union(geom::geometry)
                                    FROM water_polygons
                                    WHERE ST_Intersects(city_boundaries.boundary::geometry, water_polygons.geom::geometry)
                                )
                            )
                        )::geography,
                        boundary
                    ),
                    center = CASE
                        WHEN (
                            SELECT COUNT(*)
                            FROM water_polygons
                            WHERE ST_Intersects(city_boundaries.boundary::geometry, water_polygons.geom::geometry)
                        ) > 0
                        THEN ST_PointOnSurface(
                            COALESCE(
                                ST_Multi(
                                    ST_Difference(
                                        boundary::geometry,
                                        (
                                            SELECT ST_Union(geom::geometry)
                                            FROM water_polygons
                                            WHERE ST_Intersects(city_boundaries.boundary::geometry, water_polygons.geom::geometry)
                                        )
                                    )
                                ),
                                boundary::geometry
                            )
                        )::geography
                        ELSE center
                    END
                WHERE id = $1
            `, [cityId]);

            await client.query('COMMIT');

            // Fetch and return the updated city
            const savedCity = await CityService.getById(cityId);
            if (!savedCity) {
                throw new Error('Failed to fetch saved city');
            }
            return savedCity;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error saving city from Nominatim:', error);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Find city by coordinates
     */
    /**
     * Get all local boundaries containing the given coordinates
     * Returns multiple results ordered by area (smallest/most specific first)
     */
    reverseGeocodeAll: async (lat: number, lng: number, limit: number = 10): Promise<City[]> => {
        const result = await pool.query(`
            SELECT
                id, name, province, country, display_name,
                osm_id, osm_type, type, class, importance,
                ST_Y(center::geometry) as lat,
                ST_X(center::geometry) as lng
            FROM city_boundaries
            WHERE ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
            ORDER BY ST_Area(boundary::geometry) ASC
            LIMIT $3
        `, [lng, lat, limit]);

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            displayName: row.display_name,
            center: { lat: row.lat, lng: row.lng },
            osmId: parseInt(row.osm_id),
            osmType: row.osm_type,
            type: row.type,
            class: row.class,
            importance: row.importance
        }));
    },

    reverseGeocode: async (lat: number, lng: number): Promise<City | null> => {
        // 1. Check local DB first
        const result = await pool.query(`
            SELECT
                id, name, province, country, display_name,
                osm_id, osm_type, type, class, importance,
                ST_Y(center::geometry) as lat,
                ST_X(center::geometry) as lng
            FROM city_boundaries
            WHERE ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
            ORDER BY ST_Area(boundary::geometry) ASC
            LIMIT 1
        `, [lng, lat]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                id: row.id,
                name: row.name,
                province: row.province,
                country: row.country,
                displayName: row.display_name,
                center: { lat: row.lat, lng: row.lng },
                osmId: parseInt(row.osm_id),
                osmType: row.osm_type,
                type: row.type,
                class: row.class,
                importance: row.importance
            };
        }

        // 2. Call Nominatim reverse API when not in DB
        const params = new URLSearchParams({
            lat: String(lat),
            lon: String(lng),
            format: 'json',
            addressdetails: '1',
            zoom: '10' // City level
        });

        const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;

        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
            });

            if (!response.ok) {
                throw new Error(`Nominatim reverse API error: ${response.statusText}`);
            }

            const data = await response.json() as NominatimResponse;

            return {
                id: '',
                displayName: data.display_name,
                osmId: data.osm_id,
                osmType: data.osm_type,
                name: data.address?.city || data.address?.town || data.address?.village || 'Unknown',
                province: data.address?.state || data.address?.province || 'Unknown',
                country: data.address?.country || 'Unknown',
                center: { lat: parseFloat(data.lat), lng: parseFloat(data.lon) },
                type: data.type,
                class: data.class,
                importance: data.importance
            };
        } catch (error) {
            console.error('Error reverse geocoding:', error);
            return null;
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
    },

    getById: async (id: string): Promise<City | null> => {
        const result = await pool.query(`
            SELECT
                id, name, province, country,
                display_name, osm_id, osm_type, type, class, importance,
                ST_AsGeoJSON(boundary)::json as boundary,
                ST_AsGeoJSON(raw_boundary)::json as raw_boundary,
                ST_Y(center::geometry) as lat,
                ST_X(center::geometry) as lng,
                last_updated, needs_refresh
            FROM city_boundaries
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            displayName: row.display_name,
            boundary: row.boundary,
            rawBoundary: row.raw_boundary,
            center: { lat: row.lat, lng: row.lng },
            osmId: parseInt(row.osm_id),
            osmType: row.osm_type,
            type: row.type,
            class: row.class,
            importance: row.importance,
            lastUpdated: row.last_updated,
            needsRefresh: row.needs_refresh
        };
    }
};