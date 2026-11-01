import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cacheGet, cacheSet } = vi.hoisted(() => ({
    cacheGet: vi.fn(async () => null), cacheSet: vi.fn(async () => undefined),
}));
vi.mock('../config/database', () => ({ default: { query: vi.fn(async () => ({ rows: [] })) } }));
vi.mock('../services/searchCacheService', () => ({ SearchCacheService: { get: cacheGet, set: cacheSet } }));
vi.mock('../services/locationLocalizationService', () => ({ LocationLocalizationService: {} }));
vi.mock('../services/nominatimRateLimiter', () => ({
    nominatimLimiter: { enqueue: (callback: () => Promise<unknown>) => callback() },
}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
});

afterEach(() => vi.unstubAllGlobals());

describe('explicit geocoding language and cache isolation', () => {
    it.each([undefined, 'native', 'ja', 'en'] as const)('requests %s without reusing the legacy default cache', async language => {
        const { TextSearch } = await import('../services/searchHelper');
        await TextSearch.getNominatimResults('Miyagi Prefecture, Japan', 5, language);
        const expected = language ?? 'native';
        expect(cacheGet).toHaveBeenCalledWith('Miyagi Prefecture, Japan', expected);
        expect(cacheSet).toHaveBeenCalledWith('Miyagi Prefecture, Japan', [], expected);
        const [url, options] = vi.mocked(fetch).mock.calls[0];
        expect(new URL(String(url)).searchParams.get('accept-language')).toBe(expected);
        expect(options?.headers).toMatchObject({ 'accept-language': expected });
    });

    it('normalizes old chains when reading both JSON and JSONB values', async () => {
        const { parseLocalizedNames } = await import('../services/cityService');
        const chain = {
            city: { ja: '滋賀県', native: '滋賀県' },
            province: { native: '滋賀县' }, country: { native: '日本' },
        };
        const expected = { city: chain.city, country: chain.country };
        expect(parseLocalizedNames(chain)).toEqual(expected);
        expect(parseLocalizedNames(JSON.stringify(chain))).toEqual(expected);
        expect(parseLocalizedNames(null)).toBeNull();
    });
});
