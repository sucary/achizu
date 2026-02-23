import { describe, it, expect } from 'vitest';
import { SearchCacheService } from '../services/searchCacheService';

describe('SearchCacheService', () => {
    describe('normalizeKeyword', () => {
        it('trims whitespace', () => {
            expect(SearchCacheService.normalizeKeyword('  tokyo  ')).toBe('tokyo');
        });

        it('converts to lowercase', () => {
            expect(SearchCacheService.normalizeKeyword('TOKYO')).toBe('tokyo');
            expect(SearchCacheService.normalizeKeyword('Tokyo')).toBe('tokyo');
        });

        it('collapses multiple spaces', () => {
            expect(SearchCacheService.normalizeKeyword('new   york   city')).toBe('new york city');
        });

        it('handles mixed cases', () => {
            expect(SearchCacheService.normalizeKeyword('  New   YORK  ')).toBe('new york');
        });

        it('preserves non-latin characters', () => {
            expect(SearchCacheService.normalizeKeyword('東京')).toBe('東京');
            expect(SearchCacheService.normalizeKeyword('  東京都  ')).toBe('東京都');
        });

        it('handles empty string', () => {
            expect(SearchCacheService.normalizeKeyword('')).toBe('');
            expect(SearchCacheService.normalizeKeyword('   ')).toBe('');
        });

        it('normalizes romanized Japanese consistently', () => {
            expect(SearchCacheService.normalizeKeyword('Shinjuku')).toBe('shinjuku');
            expect(SearchCacheService.normalizeKeyword('SHINJUKU')).toBe('shinjuku');
            expect(SearchCacheService.normalizeKeyword('  shinjuku  ')).toBe('shinjuku');
        });
    });
});
