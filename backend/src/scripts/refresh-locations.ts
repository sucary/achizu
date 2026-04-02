import 'dotenv/config';
import pool from '../config/database';
import { CityService } from '../services/cityService';

/**
 * Re-fetches locations data from Nominatim to fix display_names
 * that may have been corrupted or lost their romanized text.
 */
async function refreshLocations() {
    console.log('Fetching locations entries to refresh...\n');

    const result = await pool.query(`
        SELECT id, name, osm_id, osm_type, display_name
        FROM locations
        ORDER BY name
    `);

    console.log(`Found ${result.rows.length} entries to refresh.\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of result.rows) {
        try {
            console.log(`Refreshing: ${row.name} (OSM ${row.osm_type}/${row.osm_id})`);
            console.log(`  Current display_name: ${row.display_name}`);

            // Fetch fresh data from Nominatim
            const nominatimData = await CityService.fetchByOsmId(row.osm_id, row.osm_type);

            if (!nominatimData) {
                console.log(`  WARNING: No data returned from Nominatim, skipping\n`);
                errorCount++;
                continue;
            }

            console.log(`  New display_name: ${nominatimData.display_name}`);

            // Update the entry with fresh data
            await pool.query(`
                UPDATE locations
                SET display_name = $1
                WHERE id = $2
            `, [nominatimData.display_name, row.id]);

            console.log(`  Updated!\n`);
            successCount++;

            // Rate limit - Nominatim requires 1 request per second
            await new Promise(resolve => setTimeout(resolve, 1100));

        } catch (error) {
            console.error(`  ERROR refreshing ${row.name}:`, error);
            errorCount++;
        }
    }

    console.log(`\nDone. Success: ${successCount}, Errors: ${errorCount}`);
    await pool.end();
}

refreshLocations().catch(err => {
    console.error('Fatal error:', err);
    pool.end();
    process.exit(1);
});
