import pool, { verifyDatabaseConnection } from '../config/database';
import { CityService } from '../services/cityService';

/**
 * Fetches and saves all cities referenced in priority_locations
 * that don't yet exist in city_boundaries.
 */
async function seedPriorityCities() {
    await verifyDatabaseConnection();

    try {
        // Get priority locations that aren't in city_boundaries yet
        const result = await pool.query(`
            SELECT pl.osm_id, pl.osm_type, pl.display_name
            FROM priority_locations pl
            LEFT JOIN city_boundaries cb ON cb.osm_id = pl.osm_id AND cb.osm_type = pl.osm_type
            WHERE cb.id IS NULL
        `);

        if (result.rows.length === 0) {
            console.log('All priority cities already exist in city_boundaries.');
            return;
        }

        console.log(`Found ${result.rows.length} priority cities to fetch:\n`);

        for (const row of result.rows) {
            console.log(`Fetching: ${row.display_name} (OSM ${row.osm_type} ${row.osm_id})...`);

            try {
                // Fetch from Nominatim with boundary
                const nominatimData = await CityService.fetchByOsmId(row.osm_id, row.osm_type);

                if (!nominatimData) {
                    console.log(`  ❌ Not found on Nominatim\n`);
                    continue;
                }

                // Save to city_boundaries (with water polygon cutting)
                const savedCity = await CityService.saveFromNominatim(nominatimData);
                console.log(`  ✓ Saved as: ${savedCity.name}, ${savedCity.province}\n`);

            } catch (error) {
                console.log(`  ❌ Error: ${error instanceof Error ? error.message : error}\n`);
            }

            // Rate limit: Nominatim allows 1 request per second
            await new Promise(resolve => setTimeout(resolve, 1100));
        }

        console.log('Done!');

    } catch (error) {
        console.error('Error seeding priority cities:', error);
    } finally {
        await pool.end();
    }
}

seedPriorityCities();
