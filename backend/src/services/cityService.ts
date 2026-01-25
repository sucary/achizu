import pool from '../config/database';
import { City, NominatimResponse, NominatimSearchResult } from '../types/city';

export const CityService = {
    /**
     * (old) Get city data, fetching from Nominatim if not in DB
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
        return await CityService.saveFromNominatim(nominatimData);
    },

    /**
     * Fetch city data from DB by name and province
     */
    getFromDb: async (name: string, province: string): Promise<City | null> => {
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
            WHERE name = $1 AND province = $2
        `, [name, province]);

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
            osmId: row.osm_id,
            osmType: row.osm_type,
            type: row.type,
            class: row.class,
            importance: row.importance,
            lastUpdated: row.last_updated,
            needsRefresh: row.needs_refresh
        };
    },

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
                name ILIKE $1
                OR province ILIKE $1
                OR display_name ILIKE $1
            ORDER BY importance DESC NULLS LAST
            LIMIT $2
        `, [`%${query}%`, limit]);

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            displayName: row.display_name,
            center: { lat: row.lat, lng: row.lng },
            osmId: row.osm_id,
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
                cb.id, cb.name, cb.province, cb.country, cb.display_name,
                cb.osm_id, cb.osm_type, cb.type, cb.class, cb.importance,
                ST_Y(cb.center::geometry) as lat,
                ST_X(cb.center::geometry) as lng,
                pl.rank
            FROM priority_locations pl
            JOIN city_boundaries cb ON cb.osm_id = pl.osm_id AND cb.osm_type = pl.osm_type
            WHERE pl.search_query = LOWER($1)
            ORDER BY pl.rank ASC
        `, [query]);

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            displayName: row.display_name,
            center: { lat: row.lat, lng: row.lng },
            osmId: row.osm_id,
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
            polygon_geojson: '0'
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

            return data.map(item => ({
                displayName: item.display_name,
                osmId: item.osm_id,
                osmType: item.osm_type,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: item.type,
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
     * (old) Fetch from Nominatim API by city and state
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
            osmId: row.osm_id,
            osmType: row.osm_type,
            type: row.type,
            class: row.class,
            importance: row.importance,
            lastUpdated: row.last_updated,
            needsRefresh: row.needs_refresh
        };
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
     * Save city from Nominatim data
     */
    saveFromNominatim: async (data: NominatimResponse): Promise<City> => {
        const city = data.address?.city
                  || data.address?.administrative
                  || data.address?.town
                  || data.address?.village
                  || data.name
                  || 'Unknown';
        const province = data.address?.state || data.address?.province || data.address?.region || 'Unknown';
        const country = data.address?.country || 'Unknown';

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (!data.geojson) {
                throw new Error('No geojson data from Nominatim');
            }

            const geojson = data.geojson.type === 'Polygon'
                ? { type: 'MultiPolygon', coordinates: [data.geojson.coordinates] }
                : data.geojson;

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
                    ST_SetSRID(ST_GeomFromGeoJSON($12), 4326)::geography,
                    ST_SetSRID(ST_GeomFromGeoJSON($12), 4326)::geography,
                    ST_SetSRID(ST_MakePoint($13, $14), 4326)::geography
                )
                ON CONFLICT (osm_id, osm_type) DO UPDATE SET
                    last_updated = NOW()
                RETURNING id
            `, [
                city,
                province,
                country,
                data.display_name,
                data.osm_id,
                data.osm_type,
                data.type,
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
                        ST_Difference(
                            boundary::geometry,
                            (
                                SELECT ST_Union(geom::geometry)
                                FROM water_polygons
                                WHERE ST_Intersects(city_boundaries.boundary::geometry, water_polygons.geom::geometry)
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
                                ST_Difference(
                                    boundary::geometry,
                                    (
                                        SELECT ST_Union(geom::geometry)
                                        FROM water_polygons
                                        WHERE ST_Intersects(city_boundaries.boundary::geometry, water_polygons.geom::geometry)
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
                osmId: row.osm_id,
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
            osmId: row.osm_id,
            osmType: row.osm_type,
            type: row.type,
            class: row.class,
            importance: row.importance,
            lastUpdated: row.last_updated,
            needsRefresh: row.needs_refresh
        };
    }
};