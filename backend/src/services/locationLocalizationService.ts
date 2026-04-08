import pool from '../config/database';
import {
    LocalizationData,
    LocalizedLevel,
    LocalizedLocation,
    LocalizedNames,
} from '../types/city';
import { CityService } from './cityService';
import { nominatimLimiter } from './nominatimRateLimiter';

/**
 * LocationLocalizationService
 *
 * Lazily populates multilingual name data for a `locations` row plus its
 * parent admin chain (province, country). Called from ArtistService.create
 * / update the first time an artist is saved with a given city, so that
 * downstream renders can show the location in the user's preferred language.
 *
 * Strategy:
 *   1. Read the city row's center coordinate from the DB.
 *   2. Plan B Overpass query: `is_in(lat,lng)` -> all containing admin
 *      relations 2..8 with full tag set. Multi-endpoint with timeout.
 *   3. Parse `name`, `name:en`, `name:zh`, `name:ja` per relation, bucket
 *      by `admin_level` into city / province / country.
 *   4. Persist top-down in a transaction: upsert country, upsert province,
 *      then update the existing city row in place. Stamps `localized_at`.
 *   5. On Overpass failure, fall back to LocationIQ (3 lookups, one per
 *      accept-language). On total failure, return null - caller decides
 *      whether to block.
 *
 * Idempotent: a row whose `localized_at` is non-null short-circuits.
 */

const OVERPASS_ENDPOINTS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
];

const OVERPASS_TIMEOUT_MS = 5_000;

const LOCATIONIQ_BASE = 'https://us1.locationiq.com/v1';
const LOCATIONIQ_KEY = process.env.LOCATIONIQ_API_KEY;

/**
 * Bucket Overpass relations into our 3-rung model based on admin_level.
 *
 * OSM admin_level varies by country (Tokyo at 4, US cities at 8) so we
 * treat the level as ordinal. <=3 is country, 4-5 is province/state,
 * 6-8 is city. Per rung we keep the most specific candidate.
 */
function bucketByAdminLevel(levels: LocalizedLevel[]): LocalizationData {
    let city: LocalizedLevel | undefined;
    let province: LocalizedLevel | undefined;
    let country: LocalizedLevel | undefined;

    for (const level of levels) {
        if (level.adminLevel <= 3) {
            if (!country || level.adminLevel < country.adminLevel) country = level;
        } else if (level.adminLevel <= 5) {
            if (!province || level.adminLevel > province.adminLevel) province = level;
        } else {
            if (!city || level.adminLevel > city.adminLevel) city = level;
        }
    }

    return { city, province, country };
}

function parseOverpassTags(tags: Record<string, string> | undefined): LocalizedNames {
    const t = tags ?? {};
    const names: LocalizedNames = {};
    if (t['name:en']) names.en = t['name:en'];
    if (t['name:zh']) names.zh = t['name:zh'];
    if (t['name:ja']) names.ja = t['name:ja'];
    if (t.name) names.native = t.name;
    return names;
}

interface OverpassRelation {
    type: string;
    id: number;
    tags?: Record<string, string>;
}

interface OverpassResponse {
    elements?: OverpassRelation[];
}

export const LocationLocalizationService = {
    /**
     * Make sure the given location row has multilingual data populated.
     * Idempotent. Returns the localized chain on success, null on total
     * failure. Never throws.
     */
    ensureLocalized: async (locationId: string): Promise<LocalizedLocation | null> => {
        try {
            const existing = await pool.query(
                `SELECT localized_at,
                        ST_Y(center::geometry) as lat,
                        ST_X(center::geometry) as lng,
                        osm_id, osm_type
                 FROM locations WHERE id = $1`,
                [locationId]
            );

            if (existing.rows.length === 0) {
                console.warn(`[localize] location ${locationId} not found`);
                return null;
            }

            const row = existing.rows[0];

            if (row.localized_at) {
                return CityService.getLocalizedById(locationId);
            }

            if (row.lat === null || row.lng === null) {
                console.warn(`[localize] location ${locationId} has no center; skipping`);
                return null;
            }

            const lat = parseFloat(row.lat);
            const lng = parseFloat(row.lng);

            let data = await LocationLocalizationService.fetchFromOverpass(lat, lng);

            if (!data || (!data.city && !data.province && !data.country)) {
                console.warn(`[localize] Overpass returned nothing for ${locationId}; trying LocationIQ`);
                data = await LocationLocalizationService.fetchFromLocationIQ(
                    Number(row.osm_id),
                    row.osm_type
                );
            }

            if (!data) {
                console.warn(`[localize] both providers failed for ${locationId}`);
                return null;
            }

            await LocationLocalizationService.persistLocalization(locationId, data);

            return CityService.getLocalizedById(locationId);
        } catch (error) {
            console.error(`[localize] ensureLocalized failed for ${locationId}:`, error);
            return null;
        }
    },

    /**
     * Plan B: coordinate-based `is_in` Overpass query, the proven form
     * already used in cityService.getContainingBoundaries. Returns the
     * full tag set so we can read every name:* variant.
     */
    fetchFromOverpass: async (lat: number, lng: number): Promise<LocalizationData | null> => {
        const query = `
            [out:json][timeout:10];
            is_in(${lat},${lng})->.a;
            rel(pivot.a)[boundary=administrative][admin_level~"^[2-8]$"];
            out tags;
        `;

        for (const url of OVERPASS_ENDPOINTS) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `data=${encodeURIComponent(query)}`,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.warn(`[localize] Overpass ${url} returned ${response.status}`);
                    continue;
                }

                const json = (await response.json()) as OverpassResponse;
                const levels: LocalizedLevel[] = [];

                for (const element of json.elements ?? []) {
                    if (element.type !== 'relation') continue;
                    const tags = element.tags ?? {};
                    const adminLevel = parseInt(tags.admin_level ?? '0', 10);
                    if (!adminLevel) continue;

                    const names = parseOverpassTags(tags);
                    if (!names.native && !names.en) continue;

                    levels.push({
                        osmId: element.id,
                        osmType: 'relation',
                        adminLevel,
                        names,
                    });
                }

                if (levels.length === 0) continue;
                return bucketByAdminLevel(levels);
            } catch (error) {
                console.warn(`[localize] Overpass ${url} failed:`, error);
                continue;
            }
        }

        return null;
    },

    /**
     * Fallback: 3 LocationIQ lookups (en, zh, ja) on the city's OSM id.
     * Reads `name`/`state`/`country` per language and folds them into the
     * LocalizationData shape. Lower fidelity than Overpass — we only learn
     * names for the city, province, country *as LocationIQ knows them*,
     * not the parent OSM relation IDs. Parent rows are upserted by name
     * with synthetic osm_id = 0 / osm_type = 'placeholder', which is fine
     * because they exist solely as render nodes.
     */
    fetchFromLocationIQ: async (osmId: number, osmType: string): Promise<LocalizationData | null> => {
        if (!LOCATIONIQ_KEY) return null;
        const osmTypePrefix = osmType.charAt(0).toUpperCase();
        const osmIds = `${osmTypePrefix}${osmId}`;

        const langs: Array<'en' | 'zh' | 'ja'> = ['en', 'zh', 'ja'];

        const cityNames: LocalizedNames = {};
        const provinceNames: LocalizedNames = {};
        const countryNames: LocalizedNames = {};

        for (const lang of langs) {
            try {
                const params = new URLSearchParams({
                    osm_ids: osmIds,
                    format: 'json',
                    addressdetails: '1',
                    'accept-language': lang,
                });
                const url = `${LOCATIONIQ_BASE}/lookup?${params.toString()}&key=${LOCATIONIQ_KEY}`;
                const response = await nominatimLimiter.enqueue(() =>
                    fetch(url, { headers: { 'User-Agent': 'ArtistLocationMap/1.0' } })
                );
                if (!response.ok) continue;
                const arr = (await response.json()) as Array<{
                    name?: string;
                    address?: { city?: string; town?: string; village?: string; state?: string; province?: string; country?: string };
                }>;
                if (!arr || arr.length === 0) continue;
                const data = arr[0];

                const cityName =
                    data.address?.city ?? data.address?.town ?? data.address?.village ?? data.name;
                const provinceName = data.address?.state ?? data.address?.province;
                const countryName = data.address?.country;

                if (cityName) cityNames[lang] = cityName;
                if (provinceName) provinceNames[lang] = provinceName;
                if (countryName) countryNames[lang] = countryName;
            } catch (error) {
                console.warn(`[localize] LocationIQ ${lang} lookup failed:`, error);
            }
        }

        if (Object.keys(cityNames).length === 0) return null;

        return {
            city: { osmId, osmType, adminLevel: 8, names: cityNames },
            province: Object.keys(provinceNames).length
                ? { osmId: 0, osmType: 'placeholder', adminLevel: 4, names: provinceNames }
                : undefined,
            country: Object.keys(countryNames).length
                ? { osmId: 0, osmType: 'placeholder', adminLevel: 2, names: countryNames }
                : undefined,
        };
    },

    /**
     * Upsert country -> province in `locations`, then update the existing
     * city row in place. Single transaction so partial localization never
     * leaks. Idempotent via the `uq_location_osm` constraint (or by native
     * name + admin level for LocationIQ-fallback placeholders).
     */
    persistLocalization: async (cityLocationId: string, data: LocalizationData): Promise<void> => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let countryId: string | null = null;
            if (data.country) {
                countryId = await upsertParent(client, data.country, null);
            }

            let provinceId: string | null = null;
            if (data.province) {
                provinceId = await upsertParent(client, data.province, countryId);
            }

            // Update city row in place. Prefer parent_id = province, falling
            // back to country when there's no province (city-states).
            const parentForCity = provinceId ?? countryId;
            const cityNames = data.city?.names ?? null;
            const cityAdminLevel = data.city?.adminLevel ?? null;

            await client.query(
                `UPDATE locations
                 SET names = COALESCE($2, names),
                     admin_level = COALESCE($3, admin_level),
                     parent_id = COALESCE($4, parent_id),
                     localized_at = NOW()
                 WHERE id = $1`,
                [cityLocationId, cityNames, cityAdminLevel, parentForCity]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
};

/**
 * Upsert a parent admin row (country or province) into `locations`.
 */
async function upsertParent(
    client: import('pg').PoolClient,
    level: LocalizedLevel,
    parentId: string | null
): Promise<string> {
    const nativeName = level.names.native ?? level.names.en ?? 'Unknown';

    const legacyProvince = '';
    const legacyCountry = '';

    if (level.osmType === 'placeholder') {
        const found = await client.query(
            `SELECT id FROM locations
             WHERE osm_type = 'placeholder'
               AND admin_level = $1
               AND names->>'native' IS NOT DISTINCT FROM $2
             LIMIT 1`,
            [level.adminLevel, level.names.native ?? null]
        );
        if (found.rows.length > 0) {
            await client.query(
                `UPDATE locations
                 SET names = $2,
                     parent_id = COALESCE($3, parent_id),
                     localized_at = NOW()
                 WHERE id = $1`,
                [found.rows[0].id, level.names, parentId]
            );
            return found.rows[0].id;
        }

        const inserted = await client.query(
            `INSERT INTO locations
                (name, province, country, osm_id, osm_type, admin_level, names, parent_id, localized_at)
             VALUES ($1, $2, $3, 0, 'placeholder', $4, $5, $6, NOW())
             RETURNING id`,
            [nativeName, legacyProvince, legacyCountry, level.adminLevel, level.names, parentId]
        );
        return inserted.rows[0].id;
    }

    const result = await client.query(
        `INSERT INTO locations
            (name, province, country, osm_id, osm_type, admin_level, names, parent_id, localized_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (osm_id, osm_type) DO UPDATE
         SET names = EXCLUDED.names,
             admin_level = EXCLUDED.admin_level,
             parent_id = COALESCE(EXCLUDED.parent_id, locations.parent_id),
             localized_at = NOW()
         RETURNING id`,
        [nativeName, legacyProvince, legacyCountry, level.osmId, level.osmType, level.adminLevel, level.names, parentId]
    );
    return result.rows[0].id;
}
