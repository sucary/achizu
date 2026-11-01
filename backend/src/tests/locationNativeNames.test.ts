import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../config/database', () => ({ default: { query } }));
vi.mock('../services/cityService', () => ({ CityService: {} }));
vi.mock('../services/nominatimRateLimiter', () => ({
    nominatimLimiter: { enqueue: (callback: () => Promise<unknown>) => callback() },
}));

const translations = {
    city: { en: 'Samarinda', ja: 'サマリンダ', zhHans: '沙马林达' },
    province: { en: 'East Kalimantan', ja: '東カリマンタン州', native: '东加里曼丹省' },
    country: { en: 'Indonesia', ja: 'インドネシア', native: '印度尼西亚 / 印度尼西亞' },
};

function mockDatabase(withSiblingNames: boolean, withManualNames = false) {
    query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT localized_at')) {
            return { rows: [{
                osm_id: 14921097, osm_type: 'relation',
                name: '沙马林达', province: '东加里曼丹省', country: '印度尼西亚 / 印度尼西亞',
                address_components: { country_code: 'id' },
            }] };
        }
        if (sql.includes('WHERE id !=') && withSiblingNames) {
            return { rows: [{ localized_names: translations }] };
        }
        if (sql.includes('localized_manual = TRUE') && withManualNames) {
            return { rows: [{ localized_names: { province: { native: 'Curated province' } } }] };
        }
        return { rows: [] };
    });
}

function mockLookups(nativeLookupFails = false) {
    const responses = [
        { name: '沙马林达', namedetails: { 'name:en': 'Samarinda', 'name:ja': 'サマリンダ' },
            address: { state: 'East Kalimantan', country: 'Indonesia', country_code: 'id' } },
        { address: { state: '东加里曼丹省', country: '印度尼西亚' } },
        { address: { state: '東加里曼丹省', country: '印度尼西亞' } },
        { address: { state: '東カリマンタン州', country: 'インドネシア' } },
        { name: 'Samarinda', address: { state: 'Kalimantan Timur', country: 'Indonesia' } },
    ];
    const fetchMock = vi.fn(async () => {
        const response = responses.shift();
        return { ok: !(nativeLookupFails && responses.length === 0), status: 503, json: async () => [response] };
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

beforeEach(() => {
    vi.resetModules();
    query.mockReset();
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key');
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('native location names', () => {
    it.each([
        ['宮城県', '東北地方', '宮城県'],
        ['石狩振興局', '北海道', '北海道'],
    ])('resolves the prefecture through %s without replacing it with a region', async (parent, grandparent, expected) => {
        mockDatabase(false);
        const labels = (ja: string) => ({ ja: { value: ja }, en: { value: ja } });
        const claim = (id: string) => [{ mainsnak: { datavalue: { value: { id } } } }];
        const fetchMock = vi.fn(async (url: string) => {
            const request = new URL(url);
            if (request.pathname.endsWith('/lookup')) {
                return { ok: true, json: async () => [{
                    namedetails: { name: '仙台市' }, address: { country_code: 'jp', country: 'Japan' },
                    extratags: { wikidata: 'Q1' },
                }] };
            }
            const ids = request.searchParams.get('ids');
            const entities = ids === 'Q1'
                ? { Q1: { labels: labels('仙台市'), claims: { P131: claim('Q2'), P17: claim('Q17') } } }
                : ids === 'Q3' ? { Q3: { labels: labels(grandparent) } }
                    : { Q2: { labels: labels(parent), claims: { P131: claim('Q3') } }, Q17: { labels: { ...labels('日本'), en: { value: 'Japan' } } } };
            return { ok: true, json: async () => ({ entities }) };
        });
        vi.stubGlobal('fetch', fetchMock);
        const { LocationLocalizationService } = await import('../services/locationLocalizationService');
        // Keep the base country consistent with the Japanese lookup.
        const databaseMock = query.getMockImplementation()!;
        query.mockImplementation(async (...args) => {
            const result = await databaseMock(...args);
            if (args[0].includes('SELECT localized_at')) result.rows[0].country = 'Japan';
            return result;
        });
        const result = await LocationLocalizationService.ensureLocalized('japanese-city');
        expect(result?.chain.province?.native).toBe(expected);
        expect(query.mock.calls.find(([sql]) => sql.includes('UPDATE locations'))?.[1][1].province.native).toBe(expected);
    });

    it('replaces translated sibling native names with Indonesian provider names', async () => {
        mockDatabase(true);
        const fetchMock = mockLookups();
        const { LocationLocalizationService } = await import('../services/locationLocalizationService');
        const result = await LocationLocalizationService.ensureLocalized('samarinda');

        expect(result?.chain.city.native).toBe('Samarinda');
        expect(result?.chain.province?.native).toBe('Kalimantan Timur');
        expect(result?.chain.country?.native).toBe('Indonesia');
        expect(result?.chain.city.en).toBe('Samarinda');
        expect(result?.chain.city.ja).toBe('サマリンダ');
        expect(result?.chain.province?.en).toBe('East Kalimantan');
        expect(result?.chain.province?.ja).toBe('東カリマンタン州');
        expect(fetchMock.mock.calls).toHaveLength(5);
        expect(query.mock.calls.find(([sql]) => sql.includes('UPDATE locations'))?.[1][1]).toEqual(result?.chain);
    });

    it('does not label stored search-language fields as native when native lookup fails', async () => {
        mockDatabase(false);
        mockLookups(true);
        const { LocationLocalizationService } = await import('../services/locationLocalizationService');
        const result = await LocationLocalizationService.ensureLocalized('samarinda');

        expect(result?.chain.city.native).toBeUndefined();
        expect(result?.chain.province?.native).toBeUndefined();
        expect(result?.chain.country?.native).toBeUndefined();
        expect(result?.chain.city.en).toBe('Samarinda');
    });

    it('preserves explicitly curated native names over provider lookups', async () => {
        mockDatabase(true, true);
        mockLookups();
        const { LocationLocalizationService } = await import('../services/locationLocalizationService');
        const result = await LocationLocalizationService.ensureLocalized('samarinda');

        expect(result?.chain.province?.native).toBe('Curated province');
        expect(result?.chain.city.native).toBe('Samarinda');
    });
});
