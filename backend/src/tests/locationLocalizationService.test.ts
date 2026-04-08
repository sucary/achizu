import { describe, it, expect, beforeAll, afterEach, afterAll, vi, beforeEach } from 'vitest';
import { initTestDb, cleanupTestDb, closeTestDb, getPool } from './setup';

// Dynamic imports — env must be loaded by setup before pool is created.
let LocationLocalizationService: Awaited<
    typeof import('../services/locationLocalizationService')
>['LocationLocalizationService'];
let CityService: Awaited<typeof import('../services/cityService')>['CityService'];

const TOKYO_LAT = 35.6762;
const TOKYO_LNG = 139.6503;

/**
 * Insert a bare city row that mimics what `saveFromNominatim` would have
 * produced before localization runs: real geometry, NULL `names`, NULL
 * `localized_at`. Returns the row id.
 */
async function insertCityRow(name: string, osmId: number, lat: number, lng: number) {
    const pool = await getPool();
    const result = await pool.query(
        `INSERT INTO locations (name, province, boundary, center, osm_id, osm_type)
         VALUES (
            $1, $2,
            ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($4, $3), 4326)::geometry, 0.1))::geography,
            ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
            $5, 'relation'
         )
         RETURNING id`,
        [name, name, lat, lng, osmId]
    );
    return result.rows[0].id as string;
}

/**
 * Build a fake Overpass response for is_in(Tokyo). Three relations:
 * Japan (admin_level=2), Tōkyō prefecture (4), Shinjuku ward (7).
 */
function tokyoOverpassPayload() {
    return {
        elements: [
            {
                type: 'relation',
                id: 382313,
                tags: {
                    admin_level: '2',
                    boundary: 'administrative',
                    name: '日本',
                    'name:en': 'Japan',
                    'name:zh': '日本',
                    'name:ja': '日本',
                },
            },
            {
                type: 'relation',
                id: 1543125,
                tags: {
                    admin_level: '4',
                    boundary: 'administrative',
                    name: '東京都',
                    'name:en': 'Tokyo',
                    'name:zh': '东京都',
                    'name:ja': '東京都',
                },
            },
            {
                type: 'relation',
                id: 3691045,
                tags: {
                    admin_level: '7',
                    boundary: 'administrative',
                    name: '新宿区',
                    'name:en': 'Shinjuku',
                    'name:zh': '新宿区',
                    'name:ja': '新宿区',
                },
            },
        ],
    };
}

function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: async () => body,
    } as unknown as Response;
}

beforeAll(async () => {
    await initTestDb();
    const localizationModule = await import('../services/locationLocalizationService');
    LocationLocalizationService = localizationModule.LocationLocalizationService;
    const cityModule = await import('../services/cityService');
    CityService = cityModule.CityService;
});

afterEach(async () => {
    await cleanupTestDb();
    // Wipe locations between tests so localization runs from a clean slate.
    const pool = await getPool();
    await pool.query('DELETE FROM locations');
    vi.restoreAllMocks();
});

afterAll(async () => {
    await closeTestDb();
});

describe('LocationLocalizationService', () => {
    describe('ensureLocalized — happy path (Overpass)', () => {
        it('parses Overpass tags, persists hierarchy, stamps localized_at', async () => {
            const cityId = await insertCityRow('Shinjuku', 3691045, TOKYO_LAT, TOKYO_LNG);

            vi.spyOn(global, 'fetch').mockResolvedValueOnce(
                makeFetchResponse(tokyoOverpassPayload())
            );

            const result = await LocationLocalizationService.ensureLocalized(cityId);

            expect(result).not.toBeNull();
            expect(result!.city.names?.en).toBe('Shinjuku');
            expect(result!.city.names?.zh).toBe('新宿区');
            expect(result!.city.names?.ja).toBe('新宿区');
            expect(result!.city.names?.native).toBe('新宿区');

            expect(result!.province?.names?.en).toBe('Tokyo');
            expect(result!.province?.names?.zh).toBe('东京都');

            expect(result!.country?.names?.en).toBe('Japan');
            expect(result!.country?.names?.native).toBe('日本');

            // localized_at should be set
            const pool = await getPool();
            const dbRow = await pool.query(
                'SELECT localized_at, parent_id, admin_level FROM locations WHERE id = $1',
                [cityId]
            );
            expect(dbRow.rows[0].localized_at).not.toBeNull();
            expect(dbRow.rows[0].parent_id).not.toBeNull();
            expect(dbRow.rows[0].admin_level).toBe(7);
        });

        it('is idempotent — second call short-circuits without re-fetching', async () => {
            const cityId = await insertCityRow('Shinjuku', 3691045, TOKYO_LAT, TOKYO_LNG);

            const fetchSpy = vi
                .spyOn(global, 'fetch')
                .mockResolvedValue(makeFetchResponse(tokyoOverpassPayload()));

            await LocationLocalizationService.ensureLocalized(cityId);
            const callsAfterFirst = fetchSpy.mock.calls.length;

            const result = await LocationLocalizationService.ensureLocalized(cityId);
            expect(result).not.toBeNull();
            expect(result!.city.names?.en).toBe('Shinjuku');

            // Short-circuit: no new network calls.
            expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
        });
    });

    describe('ensureLocalized — failure modes', () => {
        it('returns null when Overpass returns nothing AND LocationIQ key absent', async () => {
            const cityId = await insertCityRow('Nowhereville', 9999991, 0, 0);

            // Empty Overpass response.
            vi.spyOn(global, 'fetch').mockResolvedValue(
                makeFetchResponse({ elements: [] })
            );

            // Force LocationIQ fallback to bail by clearing the key.
            const originalKey = process.env.LOCATIONIQ_API_KEY;
            delete process.env.LOCATIONIQ_API_KEY;

            try {
                const result = await LocationLocalizationService.ensureLocalized(cityId);
                expect(result).toBeNull();

                // Row should NOT be marked localized.
                const pool = await getPool();
                const dbRow = await pool.query(
                    'SELECT localized_at FROM locations WHERE id = $1',
                    [cityId]
                );
                expect(dbRow.rows[0].localized_at).toBeNull();
            } finally {
                if (originalKey !== undefined) process.env.LOCATIONIQ_API_KEY = originalKey;
            }
        });

        it('returns null gracefully when location id does not exist', async () => {
            const result = await LocationLocalizationService.ensureLocalized(
                '00000000-0000-0000-0000-000000000000'
            );
            expect(result).toBeNull();
        });

        it('skips when location row has no center coordinate', async () => {
            const pool = await getPool();
            const inserted = await pool.query(
                `INSERT INTO locations (name, province, osm_id, osm_type)
                 VALUES ('Ghost', 'Ghost', 9999992, 'relation') RETURNING id`
            );
            const id = inserted.rows[0].id;

            const fetchSpy = vi.spyOn(global, 'fetch');
            const result = await LocationLocalizationService.ensureLocalized(id);

            expect(result).toBeNull();
            // No fetch should fire — we bailed before the network call.
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('CityService.getLocalizedById', () => {
        it('walks the parent chain and returns nested city/province/country', async () => {
            const cityId = await insertCityRow('Shinjuku', 3691045, TOKYO_LAT, TOKYO_LNG);

            vi.spyOn(global, 'fetch').mockResolvedValueOnce(
                makeFetchResponse(tokyoOverpassPayload())
            );
            await LocationLocalizationService.ensureLocalized(cityId);

            const walked = await CityService.getLocalizedById(cityId);

            expect(walked).not.toBeNull();
            expect(walked!.id).toBe(cityId);
            expect(walked!.city.names?.en).toBe('Shinjuku');
            expect(walked!.province?.names?.en).toBe('Tokyo');
            expect(walked!.country?.names?.en).toBe('Japan');
        });

        it('returns null for unknown id', async () => {
            const result = await CityService.getLocalizedById(
                '00000000-0000-0000-0000-000000000000'
            );
            expect(result).toBeNull();
        });
    });
});
