import pool from '../config/database';
import { NominatimSearchResult } from '../types/city';

const CACHE_DURATION_DAYS = 14;

export const SearchCacheService = {
    /**
     * Normalize keyword for consistent cache lookups
     * - lowercase
     * - trim whitespace
     * - collapse multiple spaces
     */
    normalizeKeyword(query: string): string {
        return query.trim().toLowerCase().replace(/\s+/g, ' ');
    },

    /**
     * Get cached search results for a keyword
     * Returns null if not found or expired
     */
    async get(query: string): Promise<NominatimSearchResult[] | null> {
        const keyword = this.normalizeKeyword(query);

        try {
            // Update hit_count and return results in one query
            const result = await pool.query(`
                UPDATE search_cache
                SET hit_count = hit_count + 1
                WHERE keyword = $1 AND expires_at > NOW()
                RETURNING results
            `, [keyword]);

            if (result.rows.length === 0) return null;
            return result.rows[0].results as NominatimSearchResult[];
        } catch (error) {
            console.error('Error fetching from search cache:', error);
            return null;
        }
    },

    /**
     * Check if a keyword is cached (without incrementing hit count)
     */
    async has(query: string): Promise<boolean> {
        const keyword = this.normalizeKeyword(query);

        try {
            const result = await pool.query(`
                SELECT 1 FROM search_cache
                WHERE keyword = $1 AND expires_at > NOW()
                LIMIT 1
            `, [keyword]);

            return result.rows.length > 0;
        } catch (error) {
            console.error('Error checking search cache:', error);
            return false;
        }
    },

    /**
     * Cache search results for a keyword
     */
    async set(query: string, results: NominatimSearchResult[]): Promise<void> {
        const keyword = this.normalizeKeyword(query);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + CACHE_DURATION_DAYS);

        try {
            await pool.query(`
                INSERT INTO search_cache (keyword, results, result_count, expires_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (keyword) DO UPDATE SET
                    results = EXCLUDED.results,
                    result_count = EXCLUDED.result_count,
                    expires_at = EXCLUDED.expires_at
            `, [keyword, JSON.stringify(results), results.length, expiresAt]);
        } catch (error) {
            console.error('Error saving to search cache:', error);
            // Don't throw - caching failure shouldn't break the search
        }
    },

    /**
     * Remove expired cache entries
     * Returns number of deleted entries
     */
    async cleanup(): Promise<number> {
        try {
            const result = await pool.query(`
                DELETE FROM search_cache WHERE expires_at < NOW()
            `);
            return result.rowCount || 0;
        } catch (error) {
            console.error('Error cleaning up search cache:', error);
            return 0;
        }
    },

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{ totalEntries: number; totalHits: number; avgHitsPerEntry: number }> {
        try {
            const result = await pool.query(`
                SELECT
                    COUNT(*) as total_entries,
                    COALESCE(SUM(hit_count), 0) as total_hits,
                    COALESCE(AVG(hit_count), 0) as avg_hits
                FROM search_cache
                WHERE expires_at > NOW()
            `);

            const row = result.rows[0];
            return {
                totalEntries: parseInt(row.total_entries),
                totalHits: parseInt(row.total_hits),
                avgHitsPerEntry: parseFloat(row.avg_hits)
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return { totalEntries: 0, totalHits: 0, avgHitsPerEntry: 0 };
        }
    }
};
