import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { initTestDb, cleanupTestDb, closeTestDb, getPool } from './setup';

let LocationLocalizationService: Awaited<
    typeof import('../services/locationLocalizationService')
>['LocationLocalizationService'];
let CityService: Awaited<typeof import('../services/cityService')>['CityService'];

const TOKYO_LAT = 35.6762;
const TOKYO_LNG = 139.6503;

/**
 * Insert a bare city row mimicking what `saveFromNominatim` produces
 * before localization runs: real geometry, NULL `localized_names`,
 * NULL `localized_at`.
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

function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: async () => body,
    } as unknown as Response;
}

// ─── LocationIQ fixtures ────────────────────────────────────────────────

/**
 * LocationIQ /lookup response for Osaka city — wikidata tag present,
 * full namedetails set, English-language address chain.
 */
function locationIQOsakaLookup() {
    return [
        {
            name: '大阪市',
            address: { state: 'Osaka Prefecture', country: 'Japan' },
            extratags: {
                wikidata: 'Q35765',
                wikipedia: 'ja:大阪市',
                admin_level: '7',
            },
            namedetails: {
                name: '大阪市',
                'name:en': 'Osaka',
                'name:ja': '大阪市',
                'name:zh': '大阪市',
                'name:zh-Hans': '大阪市',
                'name:zh-Hant': '大阪市',
            },
        },
    ];
}

/**
 * LocationIQ /lookup response for Helsinki — NO wikidata tag (we exercise
 * the LocationIQ-only fallback branch). Rich namedetails. English address.
 */
function locationIQHelsinkiLookup() {
    return [
        {
            name: 'Helsinki',
            address: { state: 'Uusimaa', country: 'Finland' },
            extratags: {
                wikipedia: 'fi:Helsinki',
                admin_level: '8',
            },
            namedetails: {
                name: 'Helsinki',
                'name:en': 'Helsinki',
                'name:fi': 'Helsinki',
                'name:sv': 'Helsingfors',
                'name:ja': 'ヘルシンキ',
                'name:zh': '赫尔辛基',
            },
        },
    ];
}

/**
 * Per-language LocationIQ address-only response, returned by the 3
 * follow-up calls in the LocationIQ-only fallback branch.
 */
function locationIQAddressLookup(state: string, country: string) {
    return [
        {
            address: { state, country },
            extratags: {},
            namedetails: {},
        },
    ];
}

// ─── Wikidata fixtures ──────────────────────────────────────────────────

/**
 * Wikidata wbgetentities response for Q35765 (Osaka city).
 * Real Q35765 has both an active P131 → Q122723 and a deprecated
 * historical P131; the fixture mirrors that to exercise the deprecation
 * filter.
 */
function wikidataOsakaCity() {
    return {
        entities: {
            Q35765: {
                id: 'Q35765',
                labels: {
                    en:        { language: 'en',       value: 'Osaka' },
                    ja:        { language: 'ja',       value: '大阪市' },
                    'zh-hans': { language: 'zh-hans',  value: '大阪市' },
                    'zh-hant': { language: 'zh-hant',  value: '大阪市' },
                    zh:        { language: 'zh',       value: '大阪市' },
                },
                claims: {
                    P131: [
                        { rank: 'deprecated', mainsnak: { datavalue: { value: { 'entity-type': 'item', id: 'Q864163' } } } },
                        { rank: 'normal',     mainsnak: { datavalue: { value: { 'entity-type': 'item', id: 'Q122723' } } } },
                    ],
                    P17: [
                        { rank: 'normal', mainsnak: { datavalue: { value: { 'entity-type': 'item', id: 'Q17' } } } },
                    ],
                },
            },
        },
    };
}

function wikidataOsakaParents() {
    return {
        entities: {
            Q122723: {
                id: 'Q122723',
                labels: {
                    en:        { language: 'en',       value: 'Osaka Prefecture' },
                    ja:        { language: 'ja',       value: '大阪府' },
                    'zh-hans': { language: 'zh-hans',  value: '大阪府' },
                    'zh-hant': { language: 'zh-hant',  value: '大阪府' },
                },
                claims: {},
            },
            Q17: {
                id: 'Q17',
                labels: {
                    en:        { language: 'en',       value: 'Japan' },
                    ja:        { language: 'ja',       value: '日本' },
                    'zh-hans': { language: 'zh-hans',  value: '日本' },
                    'zh-hant': { language: 'zh-hant',  value: '日本' },
                },
                claims: {},
            },
        },
    };
}

/** Empty Wikidata response — exercises the "QID exists in tag but Wikidata returns nothing" path. */
function wikidataEmpty() {
    return { entities: {} };
}

beforeAll(async () => {
    // The service captures `process.env.LOCATIONIQ_API_KEY` into a module
    // constant at import time and refuses to call LocationIQ when unset.
    // Tests mock fetch anyway, but the env check happens before fetch is
    // ever called — so we must set this *before* the dynamic import below.
    if (!process.env.LOCATIONIQ_API_KEY) {
        process.env.LOCATIONIQ_API_KEY = 'test-key';
    }

    await initTestDb();
    const localizationModule = await import('../services/locationLocalizationService');
    LocationLocalizationService = localizationModule.LocationLocalizationService;
    const cityModule = await import('../services/cityService');
    CityService = cityModule.CityService;
});

afterEach(async () => {
    await cleanupTestDb();
    const pool = await getPool();
    await pool.query('DELETE FROM locations');
    vi.restoreAllMocks();
});

afterAll(async () => {
    await closeTestDb();
});

describe('LocationLocalizationService — Wikidata-first via LocationIQ', () => {
    describe('happy path (Wikidata branch)', () => {
        it('reads wikidata tag from LocationIQ extratags, walks Wikidata chain, persists localized_names', async () => {
            const cityId = await insertCityRow('大阪市', 358674, TOKYO_LAT, TOKYO_LNG);

            const fetchSpy = vi.spyOn(global, 'fetch');
            // Call 1: LocationIQ lookup → returns extratags.wikidata + namedetails + address
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQOsakaLookup()));
            // Call 2: Wikidata wbgetentities for Q35765 alone (claims + labels)
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataOsakaCity()));
            // Call 3: Wikidata wbgetentities for parents Q122723 + Q17 (batched)
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataOsakaParents()));

            const result = await LocationLocalizationService.ensureLocalized(cityId);

            expect(result).not.toBeNull();
            expect(result!.chain.city.en).toBe('Osaka');
            expect(result!.chain.city.ja).toBe('大阪市');
            expect(result!.chain.city.zhHans).toBe('大阪市');
            expect(result!.chain.city.zhHant).toBe('大阪市');
            expect(result!.chain.city.native).toBe('大阪市');

            expect(result!.chain.province?.en).toBe('Osaka Prefecture');
            expect(result!.chain.province?.ja).toBe('大阪府');
            expect(result!.chain.province?.zhHant).toBe('大阪府');

            expect(result!.chain.country?.en).toBe('Japan');
            expect(result!.chain.country?.ja).toBe('日本');

            // Exactly 3 calls — 1 LocationIQ + 2 Wikidata.
            expect(fetchSpy.mock.calls.length).toBe(3);

            // localized_at stamped, localized_names populated.
            const pool = await getPool();
            const dbRow = await pool.query(
                'SELECT localized_at, localized_names FROM locations WHERE id = $1',
                [cityId]
            );
            expect(dbRow.rows[0].localized_at).not.toBeNull();
            expect(dbRow.rows[0].localized_names.city.en).toBe('Osaka');
        });

        it('skips deprecated P131 claims and picks the active one', async () => {
            // The Osaka fixture above has both deprecated and active P131 claims.
            // If the deprecation filter were broken, the parent QID would be
            // Q864163 (deprecated) instead of Q122723 (active), and we'd
            // never request Q122723|Q17 in the parents call — meaning
            // chain.province would be undefined. Asserting it's defined and
            // equal to "Osaka Prefecture" proves the active claim won.
            const cityId = await insertCityRow('大阪市', 358674, TOKYO_LAT, TOKYO_LNG);
            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQOsakaLookup()));
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataOsakaCity()));
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataOsakaParents()));

            const result = await LocationLocalizationService.ensureLocalized(cityId);
            expect(result!.chain.province?.en).toBe('Osaka Prefecture');
        });

        it('is idempotent — second call short-circuits, no fetches', async () => {
            const cityId = await insertCityRow('大阪市', 358674, TOKYO_LAT, TOKYO_LNG);

            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQOsakaLookup()));
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataOsakaCity()));
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataOsakaParents()));

            await LocationLocalizationService.ensureLocalized(cityId);
            const callsAfterFirst = fetchSpy.mock.calls.length;

            const result = await LocationLocalizationService.ensureLocalized(cityId);
            expect(result).not.toBeNull();
            expect(result!.chain.city.en).toBe('Osaka');
            // No new fetches.
            expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
        });
    });

    describe('LocationIQ-only fallback (no wikidata tag)', () => {
        it('uses initial namedetails for city + 3 more lookups for parents', async () => {
            const cityId = await insertCityRow('Helsinki', 34914, 60.1699, 24.9384);

            const fetchSpy = vi.spyOn(global, 'fetch');
            // Call 1: LocationIQ initial lookup (en) — no wikidata in extratags,
            //         so we go to the fallback branch. namedetails covers city,
            //         address.{state,country} covers the en slot of parents.
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQHelsinkiLookup()));
            // Call 2: zh-CN address lookup (state + country in simplified Chinese)
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQAddressLookup('乌西马省', '芬兰')));
            // Call 3: zh-TW address lookup (traditional Chinese — note that LocationIQ
            //         in practice often returns simplified chars even for zh-TW; the test
            //         doesn't enforce script-correctness, just that the slot is populated)
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQAddressLookup('烏西馬省', '芬蘭')));
            // Call 4: ja address lookup
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQAddressLookup('ウーシマー県', 'フィンランド')));

            const result = await LocationLocalizationService.ensureLocalized(cityId);

            expect(result).not.toBeNull();
            // City names from namedetails.
            expect(result!.chain.city.en).toBe('Helsinki');
            expect(result!.chain.city.ja).toBe('ヘルシンキ');
            // Bare `name:zh` is promoted into both Hans and Hant slots when
            // neither explicit variant exists. (Renderer falls back to whatever
            // the user's preference resolves to.)
            expect(result!.chain.city.zhHans).toBe('赫尔辛基');
            expect(result!.chain.city.zhHant).toBe('赫尔辛基');
            expect(result!.chain.city.native).toBe('Helsinki');

            // Province in 4 languages.
            expect(result!.chain.province?.en).toBe('Uusimaa');
            expect(result!.chain.province?.zhHans).toBe('乌西马省');
            expect(result!.chain.province?.zhHant).toBe('烏西馬省');
            expect(result!.chain.province?.ja).toBe('ウーシマー県');

            // Country in 4 languages.
            expect(result!.chain.country?.en).toBe('Finland');
            expect(result!.chain.country?.zhHans).toBe('芬兰');
            expect(result!.chain.country?.zhHant).toBe('芬蘭');
            expect(result!.chain.country?.ja).toBe('フィンランド');

            // Exactly 4 LocationIQ calls — initial + 3 per-language follow-ups.
            expect(fetchSpy.mock.calls.length).toBe(4);
        });
    });

    describe('failure modes', () => {
        it('returns null when initial LocationIQ lookup fails', async () => {
            const cityId = await insertCityRow('Nowhere', 9999991, 0, 0);

            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(null, false, 502));

            const result = await LocationLocalizationService.ensureLocalized(cityId);
            expect(result).toBeNull();

            const pool = await getPool();
            const dbRow = await pool.query(
                'SELECT localized_at, localized_names FROM locations WHERE id = $1',
                [cityId]
            );
            expect(dbRow.rows[0].localized_at).toBeNull();
            expect(dbRow.rows[0].localized_names).toBeNull();
        });

        it('returns null gracefully when location id does not exist', async () => {
            const result = await LocationLocalizationService.ensureLocalized(
                '00000000-0000-0000-0000-000000000000'
            );
            expect(result).toBeNull();
        });

        it('falls back to LocationIQ-only when Wikidata returns an empty entities map', async () => {
            const cityId = await insertCityRow('Phantom', 9999992, TOKYO_LAT, TOKYO_LNG);
            const fetchSpy = vi.spyOn(global, 'fetch');
            // Call 1: LocationIQ lookup with wikidata tag for a non-existent QID
            fetchSpy.mockResolvedValueOnce(
                makeFetchResponse([
                    {
                        name: 'Phantom',
                        address: { state: 'Phantasia', country: 'Phantomland' },
                        extratags: { wikidata: 'Q99999999' },
                        namedetails: { name: 'Phantom', 'name:en': 'Phantom' },
                    },
                ])
            );
            // Call 2: Wikidata wbgetentities returns empty (QID not real)
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataEmpty()));
            // Branch B kicks in. Reuses the namedetails+address from call 1
            // for city/en slot, then 3 more LocationIQ calls for the other langs.
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQAddressLookup('Phantasia', 'Phantomland')));
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQAddressLookup('Phantasia', 'Phantomland')));
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQAddressLookup('Phantasia', 'Phantomland')));

            const result = await LocationLocalizationService.ensureLocalized(cityId);

            // The Wikidata branch failed but the fallback succeeded.
            expect(result).not.toBeNull();
            expect(result!.chain.city.en).toBe('Phantom');
            expect(result!.chain.country?.en).toBe('Phantomland');
        });
    });

    describe('CityService.getLocalizedById', () => {
        it('reads the localized_names column directly and returns the chain', async () => {
            const cityId = await insertCityRow('大阪市', 358674, TOKYO_LAT, TOKYO_LNG);

            const fetchSpy = vi.spyOn(global, 'fetch');
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(locationIQOsakaLookup()));
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataOsakaCity()));
            fetchSpy.mockResolvedValueOnce(makeFetchResponse(wikidataOsakaParents()));
            await LocationLocalizationService.ensureLocalized(cityId);

            const walked = await CityService.getLocalizedById(cityId);
            expect(walked).not.toBeNull();
            expect(walked!.id).toBe(cityId);
            expect(walked!.chain.city.en).toBe('Osaka');
            expect(walked!.chain.province?.en).toBe('Osaka Prefecture');
            expect(walked!.chain.country?.en).toBe('Japan');
        });

        it('returns null for unknown id', async () => {
            const result = await CityService.getLocalizedById(
                '00000000-0000-0000-0000-000000000000'
            );
            expect(result).toBeNull();
        });

        it('returns null when row exists but has no localized_names', async () => {
            const cityId = await insertCityRow('Bare', 9999993, TOKYO_LAT, TOKYO_LNG);
            const result = await CityService.getLocalizedById(cityId);
            expect(result).toBeNull();
        });
    });
});
