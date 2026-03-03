import 'dotenv/config';
import pool from '../config/database';

interface PriorityLocationSeed {
    searchQuery: string;
    nominatimQuery: string;
    rank: number;
}

// Define what we want to seed - the script will fetch actual data from Nominatim
// Note: Tokyo 23 wards (relation 19631009) incorrectly shows as 千葉県 in Nominatim - blame Nominatim
const PRIORITY_SEEDS: PriorityLocationSeed[] = [
    { searchQuery: 'tokyo', nominatimQuery: 'Tokyo, Japan', rank: 1 },
    { searchQuery: 'tokyo', nominatimQuery: '東京23区', rank: 0 },  // Tokyo 23 special wards (central Tokyo)
    { searchQuery: 'new york', nominatimQuery: 'New York City, New York, USA', rank: 0 },
    // Add more as needed
];

interface NominatimResult {
    osm_id: number;
    osm_type: string;
    lat: string;
    lon: string;
    display_name: string;
    name?: string;
    address?: {
        city?: string;
        state?: string;
        province?: string;
        country?: string;
    };
}

async function fetchFromNominatim(query: string): Promise<NominatimResult | null> {
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '1'
    });

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    console.log(`Fetching: ${url}`);

    const response = await fetch(url, {
        headers: { 'User-Agent': 'ArtistLocationMap/1.0' }
    });

    if (!response.ok) {
        throw new Error(`Nominatim error: ${response.statusText}`);
    }

    const results = await response.json() as NominatimResult[];
    return results.length > 0 ? results[0] : null;
}

async function seedPriorityLocations() {
    console.log('Seeding priority locations from Nominatim...\n');

    for (const seed of PRIORITY_SEEDS) {
        try {
            console.log(`Processing: "${seed.searchQuery}" -> "${seed.nominatimQuery}"`);

            const result = await fetchFromNominatim(seed.nominatimQuery);

            if (!result) {
                console.log(`  No result found for "${seed.nominatimQuery}", skipping\n`);
                continue;
            }

            const name = result.name
                || result.address?.city
                || result.display_name.split(',')[0].trim();
            const province = result.address?.state || result.address?.province || '';
            const country = result.address?.country || '';

            console.log(`  Found: ${result.display_name}`);
            console.log(`  OSM: ${result.osm_type}/${result.osm_id}`);
            console.log(`  Coordinates: ${result.lat}, ${result.lon}`);

            await pool.query(`
                INSERT INTO priority_locations
                    (search_query, osm_id, osm_type, name, province, country, display_name, lat, lng, rank)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (search_query, osm_id, osm_type)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    province = EXCLUDED.province,
                    country = EXCLUDED.country,
                    display_name = EXCLUDED.display_name,
                    lat = EXCLUDED.lat,
                    lng = EXCLUDED.lng,
                    rank = EXCLUDED.rank
            `, [
                seed.searchQuery.toLowerCase(),
                result.osm_id,
                result.osm_type,
                name,
                province,
                country,
                result.display_name,
                parseFloat(result.lat),
                parseFloat(result.lon),
                seed.rank
            ]);

            console.log(`  Saved!\n`);

            // Rate limit - Nominatim requires 1 request per second
            await new Promise(resolve => setTimeout(resolve, 1100));

        } catch (error) {
            console.error(`  Error processing "${seed.searchQuery}":`, error);
        }
    }

    console.log('Done seeding priority locations.');
    await pool.end();
}

seedPriorityLocations().catch(console.error);
