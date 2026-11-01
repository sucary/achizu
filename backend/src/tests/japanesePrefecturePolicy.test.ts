import { describe, expect, it } from 'vitest';
import { applyJapanesePrefecturePolicy, JAPANESE_PREFECTURES } from '../services/japanesePrefecturePolicy';
import type { LocalizedChain } from '../types/city';

describe('Japanese prefecture names and hierarchy', () => {
    it.each(JAPANESE_PREFECTURES)('keeps %s as a prefecture directly within Japan', (english, japanese) => {
        const chain: LocalizedChain = {
            city: { en: `${english} Prefecture`, ja: japanese, native: `${english} Prefecture` },
            province: { native: 'Incorrect parent' }, country: { en: 'Japan', native: '日本' },
        };
        const normalized = applyJapanesePrefecturePolicy(chain);
        expect(normalized.city.native).toBe(japanese);
        expect(normalized.city.en).toBe(`${english} Prefecture`);
        expect(normalized.province).toBeUndefined();
        expect(chain.province?.native).toBe('Incorrect parent');
        expect(applyJapanesePrefecturePolicy(normalized)).toEqual(normalized);
    });

    it.each([
        ['栃木縣', '栃木県'], ['滋賀县', '滋賀県'],
        ['Miyagi Prefecture', '宮城県'], ['Nagasaki Prefecture', '長崎県'],
        ['Okinawa Prefecture', '沖縄県'], ['Hokkaidō', '北海道'],
    ])('repairs a city province stored as %s', (native, expected) => {
        const result = applyJapanesePrefecturePolicy({
            city: { native: 'City' }, province: { native }, country: { native: '日本' },
        });
        expect(result.province?.native).toBe(expected);
        expect(result.city.native).toBe('City');
    });

    it('keeps Osaka city distinct from Osaka prefecture and preserves translations', () => {
        const result = applyJapanesePrefecturePolicy({
            city: { en: 'Osaka', ja: '大阪市', native: '大阪市' },
            province: { en: 'Osaka Prefecture', ja: '大阪府', zhHans: '大阪府', native: 'Osaka' },
            country: { en: 'Japan' },
        });
        expect(result.city.native).toBe('大阪市');
        expect(result.province).toEqual({ en: 'Osaka Prefecture', ja: '大阪府', zhHans: '大阪府', native: '大阪府' });
    });

    it('does not infer a prefecture root from an ambiguous bare English city name', () => {
        const chain = { city: { en: 'Kyoto', native: 'Kyoto' }, province: { native: '京都府' }, country: { en: 'Japan' } };
        expect(applyJapanesePrefecturePolicy(chain).province?.native).toBe('京都府');
    });

    it('does not modify non-Japanese locations with matching names', () => {
        const chain = { city: { ja: '大阪府' }, country: { en: 'Indonesia' }, province: { native: 'Province' } };
        expect(applyJapanesePrefecturePolicy(chain)).toBe(chain);
    });
});
