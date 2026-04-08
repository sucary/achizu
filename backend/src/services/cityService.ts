import pool from '../config/database';
import { City, NominatimResponse, NominatimSearchResult } from '../types/city';
import { nominatimLimiter } from './nominatimRateLimiter';

// Geocoding API configuration (LocationIQ - Nominatim-compatible)
const GEOCODING_API_BASE = 'https://us1.locationiq.com/v1';
const GEOCODING_API_KEY = process.env.LOCATIONIQ_API_KEY;

/**
 * Get display type for a location
 */
function getDisplayType(type: string, addresstype?: string, address?: Record<string, string>, name?: string): string {
    // If addresstype is provided (standard Nominatim), use it
    if (type === 'administrative' && addresstype) {
        return addresstype;
    }

    // Infer type from address object (for LocationIQ)
    if (type === 'administrative' && address && name) {
        const nameLower = name.toLowerCase();

        // Check which address field matches the location name
        // Order matters: more specific types first
        const typeMapping: [string, string][] = [
            ['village', 'village'],
            ['town', 'town'],
            ['city', 'city'],
            ['municipality', 'municipality'],
            ['county', 'county'],
            ['state_district', 'district'],
            ['state', 'state'],
            ['province', 'province'],
            ['region', 'region'],
            ['country', 'country'],
        ];

        for (const [addressKey, displayType] of typeMapping) {
            const addressValue = address[addressKey];
            if (addressValue && addressValue.toLowerCase().includes(nameLower)) {
                return displayType;
            }
        }

        // If name not found in address, check if any key exists as a hint
        for (const [addressKey, displayType] of typeMapping) {
            if (address[addressKey]) {
                return displayType;
            }
        }
    }

    return type;
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
            FROM locations
            WHERE
                name IS NOT NULL AND name != ''
                AND center IS NOT NULL
                AND (
                    name ILIKE $1
                    OR province ILIKE $1
                    OR display_name ILIKE $1
                )
            ORDER BY
                -- Prioritize exact name matches first
                CASE WHEN LOWER(name) = LOWER($2) THEN 0 ELSE 1 END,
                -- Then prioritize name starts with query
                CASE WHEN LOWER(name) LIKE LOWER($2) || '%' THEN 0 ELSE 1 END,
                -- Then prioritize city/town/administrative types over small POIs
                CASE
                    WHEN type IN ('city', 'town', 'administrative', 'village', 'municipality', 'county', 'state', 'region') THEN 0
                    WHEN type IN ('suburb', 'neighbourhood', 'district') THEN 1
                    ELSE 2
                END,
                -- Then by importance (higher is better for cities)
                importance DESC NULLS LAST,
                -- Finally by area for same importance level
                ST_Area(boundary::geometry) DESC
            LIMIT $3
        `, [`%${query}%`, query, limit]);

        return result.rows.map((row: any) => ({
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
                cb.importance,
                ST_Y(cb.center::geometry) as cb_lat,
                ST_X(cb.center::geometry) as cb_lng
            FROM priority_locations pl
            LEFT JOIN locations cb ON cb.osm_id = pl.osm_id AND cb.osm_type = pl.osm_type
            WHERE pl.search_query = LOWER($1)
            ORDER BY pl.rank ASC
        `, [query]);

        return result.rows.map((row: any) => ({
            id: row.id,
            name: row.name,
            province: row.province,
            country: row.country,
            displayName: row.display_name,
            // Use locations center if available, otherwise fall back to priority_locations coords
            center: row.cb_lat != null
                ? { lat: parseFloat(row.cb_lat), lng: parseFloat(row.cb_lng) }
                : { lat: parseFloat(row.lat), lng: parseFloat(row.lng) },
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

        const url = `${GEOCODING_API_BASE}/search?${params.toString()}&key=${GEOCODING_API_KEY}`;

        console.log(`[GEOCODING] Calling API for: "${query}"`);

        try {
            // Use global rate limiter to ensure 1 req/sec across all users
            const response = await nominatimLimiter.enqueue(() =>
                fetch(url, {
                    headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
                })
            );

            // Handle rate limit - throw specific error
            if (response.status === 429) {
                console.error('[GEOCODING] Rate limit exceeded (429) - Too many requests');
                throw new Error('Rate limit exceeded. Please try again in a few minutes.');
            }

            if (!response.ok) {
                console.error(`[GEOCODING] API error: ${response.status} ${response.statusText}`);
                throw new Error(`Location search service error: ${response.statusText}`);
            }

            const data = await response.json() as NominatimResponse[];

            console.log(`[GEOCODING] Received ${data.length} results for: "${query}"`);

            // Debug: Check type inference
            if (data.length > 0) {
                const firstItem = data[0];
                const name = firstItem.name || firstItem.display_name.split(',')[0].trim();
                const inferredType = getDisplayType(firstItem.type, firstItem.addresstype, firstItem.address as Record<string, string>, name);
                console.log(`[GEOCODING] First result - raw type: "${firstItem.type}", inferred: "${inferredType}", name: "${name}"`);
            }

            // Save all results to locations in the background one at a time
            (async () => {
                for (const item of data) {
                    if (item.geojson) {
                        await CityService.saveFromNominatim(item).catch(() => {});
                    }
                }
            })();

            return data.map(item => {
                // Extract name from display_name (first part before comma) or use name field
                const name = item.name || item.display_name.split(',')[0].trim();
                return {
                    name,
                    displayName: item.display_name,
                    osmId: Number(item.osm_id),
                    osmType: item.osm_type,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    type: getDisplayType(item.type, item.addresstype, item.address as Record<string, string>, name),
                    class: item.class,
                    importance: item.importance,
                    address: item.address as Record<string, string>,
                    boundingBox: item.boundingbox.map(parseFloat)
                };
            });
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
            FROM locations
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
            SELECT osm_id, osm_type, id FROM locations WHERE ${conditions}
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

        const url = `${GEOCODING_API_BASE}/lookup?${params.toString()}&key=${GEOCODING_API_KEY}`;

        try {
            // Use global rate limiter to ensure 1 req/sec across all users
            const response = await nominatimLimiter.enqueue(() =>
                fetch(url, {
                    headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
                })
            );

            if (!response.ok) {
                throw new Error(`Geocoding API error: ${response.statusText}`);
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

        const url = `${GEOCODING_API_BASE}/search?${params.toString()}&key=${GEOCODING_API_KEY}`;
        console.log('Fetching parent city boundary:', url);

        try {
            // Use global rate limiter to ensure 1 req/sec across all users
            const response = await nominatimLimiter.enqueue(() =>
                fetch(url, {
                    headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
                })
            );

            if (!response.ok) {
                throw new Error(`Geocoding API error: ${response.statusText}`);
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
        const geoType: string | null = data.geojson?.type ?? null;

        // For Point/LineString geometries, try to fetch the parent city's actual boundary.
        if (geoType === 'Point' || geoType === 'LineString' || geoType === 'MultiLineString') {
            const parentCityName = data.address?.city || data.address?.town || data.address?.village;
            if (parentCityName) {
                const parentProvince = data.address?.state || data.address?.province || data.address?.region || '';
                const parentCountry = data.address?.country || '';

                console.log(`${geoType} geometry detected. Looking for parent city: ${parentCityName}, ${parentProvince}, ${parentCountry}`);

                const parentCityData = await CityService.fetchCityWithBoundary(parentCityName, parentProvince, parentCountry);
                if (parentCityData) {
                    console.log('Using parent city boundary instead of', geoType);
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
            FROM locations
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

            // LineString/MultiLineString are handled before pool.connect() above.
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
                INSERT INTO locations (
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
                getDisplayType(data.type, data.addresstype, data.address as Record<string, string>, city),
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
                UPDATE locations
                SET
                    boundary = COALESCE(
                        ST_Multi(
                            ST_Difference(
                                boundary::geometry,
                                (
                                    SELECT ST_Union(geom::geometry)
                                    FROM water_polygons
                                    WHERE ST_Intersects(locations.boundary::geometry, water_polygons.geom::geometry)
                                )
                            )
                        )::geography,
                        boundary
                    ),
                    center = CASE
                        WHEN (
                            SELECT COUNT(*)
                            FROM water_polygons
                            WHERE ST_Intersects(locations.boundary::geometry, water_polygons.geom::geometry)
                        ) > 0
                        THEN ST_PointOnSurface(
                            COALESCE(
                                ST_Multi(
                                    ST_Difference(
                                        boundary::geometry,
                                        (
                                            SELECT ST_Union(geom::geometry)
                                            FROM water_polygons
                                            WHERE ST_Intersects(locations.boundary::geometry, water_polygons.geom::geometry)
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

            // Handle duplicate key error (race condition) - return existing city
            const pgError = error as { code?: string; constraint?: string };
            if (pgError.code === '23505' && pgError.constraint === 'uq_location_province') {
                console.log('Race condition: city already exists, fetching existing');
                const existing = await pool.query(`
                    SELECT id, name, province, country, osm_id, osm_type,
                           ST_Y(center::geometry) as lat,
                           ST_X(center::geometry) as lng
                    FROM locations
                    WHERE name = $1 AND province = $2
                    LIMIT 1
                `, [city, province]);

                if (existing.rows.length > 0) {
                    const row = existing.rows[0];
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
            }

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
            FROM locations
            WHERE ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
            ORDER BY ST_Area(boundary::geometry) ASC
            LIMIT $3
        `, [lng, lat, limit]);

        return result.rows.map((row: any) => ({
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
        // Check local DB first, return smallest boundary
        const result = await pool.query(`
            SELECT
                id, name, province, country, display_name,
                osm_id, osm_type, type, class, importance,
                ST_Y(center::geometry) as lat,
                ST_X(center::geometry) as lng
            FROM locations
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

        // Fall back to Nominatim if not in DB
        return CityService.reverseGeocodeNominatim(lat, lng);
    },

    /**
     * Reverse geocode using Nominatim API only (no local DB check)
     */
    reverseGeocodeNominatim: async (lat: number, lng: number): Promise<City | null> => {
        const params = new URLSearchParams({
            lat: String(lat),
            lon: String(lng),
            format: 'json',
            addressdetails: '1',
            zoom: '18' // Most detailed level to get city/town/village
        });

        const url = `${GEOCODING_API_BASE}/reverse?${params.toString()}&key=${GEOCODING_API_KEY}`;

        try {
            // Use global rate limiter to ensure 1 req/sec across all users
            const response = await nominatimLimiter.enqueue(() =>
                fetch(url, {
                    headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
                })
            );

            if (!response.ok) {
                throw new Error(`Geocoding reverse API error: ${response.statusText}`);
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
     * Get all administrative boundaries containing a point using Overpass API
     * Returns multiple results (country, state, city, etc.) in one call
     */
    getContainingBoundaries: async (lat: number, lng: number): Promise<City[]> => {
        // Only get admin levels 2-8 (country to city)
        const query = `
            [out:json][timeout:10];
            is_in(${lat},${lng})->.a;
            rel(pivot.a)[boundary=administrative][admin_level~"^[2-8]$"];
            out tags;
        `;

        // Try multiple Overpass endpoints for reliability
        const endpoints = [
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass-api.de/api/interpreter'
        ];

        for (const url of endpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `data=${encodeURIComponent(query)}`,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.warn(`Overpass endpoint ${url} returned ${response.status}, trying next...`);
                    continue;
                }

                const data = await response.json();
                const results: City[] = [];

                // Process each relation (administrative boundary)
                for (const element of data.elements || []) {
                    if (element.type !== 'relation') continue;

                    const tags = element.tags || {};
                    const adminLevel = parseInt(tags.admin_level || '0', 10);

                    // Prefer native name
                    const name = tags.name || tags['name:en'] || '';
                    if (!name) continue;

                    // Determine type based on admin_level
                    let type = 'administrative';
                    if (adminLevel === 2) type = 'country';
                    else if (adminLevel === 4) type = 'state';
                    else if (adminLevel >= 6 && adminLevel <= 8) type = 'city';

                    results.push({
                        id: '',
                        name: name,
                        province: tags['is_in:state'] || tags['is_in:province'] || '',
                        country: tags['is_in:country'] || '',
                        displayName: name,
                        osmId: element.id,
                        osmType: 'relation',
                        type: type,
                        class: 'boundary',
                        importance: 1 - (adminLevel / 10),
                        center: { lat, lng }
                    });
                }

                // Sort by admin level (country first, then province, then city)
                results.sort((a, b) => (b.importance || 0) - (a.importance || 0));

                return results;
            } catch (error) {
                console.warn(`Overpass endpoint ${url} failed:`, error);
                continue;
            }
        }

        console.error('All Overpass endpoints failed');
        return [];
    },

    /**
     * Generate a random point within the city boundary
     */
    generateRandomPoint: async (cityId: string, minDistanceMeters: number = 150): Promise<{lat: number, lng: number} | null> => {
        const maxRetries = 5;
        let bestCandidate: { lat: number; lng: number } | null = null;
        let bestMinDist = -1;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const result = await pool.query(`
                SELECT
                    ST_Y(ST_GeometryN(point, 1)) as lat,
                    ST_X(ST_GeometryN(point, 1)) as lng
                FROM (
                    SELECT ST_GeneratePoints(boundary::geometry, 1) as point
                    FROM locations
                    WHERE id = $1
                ) as generated
            `, [cityId]);

            if (result.rows.length === 0) return null;

            const candidate = {
                lat: parseFloat(result.rows[0].lat),
                lng: parseFloat(result.rows[0].lng)
            };

            // Check distance to nearest existing marker within radius
            const nearbyResult = await pool.query(`
                SELECT MIN(nearest_dist) as min_dist FROM (
                    SELECT ST_Distance(
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                        original_display_coordinates
                    ) as nearest_dist
                    FROM artists
                    WHERE original_display_coordinates IS NOT NULL
                        AND ST_DWithin(
                            original_display_coordinates,
                            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                            $3
                        )
                    UNION ALL
                    SELECT ST_Distance(
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                        active_display_coordinates
                    ) as nearest_dist
                    FROM artists
                    WHERE active_display_coordinates IS NOT NULL
                        AND ST_DWithin(
                            active_display_coordinates,
                            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                            $3
                        )
                ) as distances
            `, [candidate.lng, candidate.lat, minDistanceMeters]);

            const minDist = nearbyResult.rows[0].min_dist;

            if (minDist === null) return candidate;

            if (parseFloat(minDist) >= minDistanceMeters) return candidate;

            if (parseFloat(minDist) > bestMinDist) {
                bestMinDist = parseFloat(minDist);
                bestCandidate = candidate;
            }
        }

        return bestCandidate;
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
            FROM locations
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