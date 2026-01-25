import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import pool from '../config/database';

const BASE_URL = 'http://localhost:3000';

async function setupTestCity() {
    const result = await pool.query(`
        INSERT INTO city_boundaries (
            name, province, country, boundary, center, osm_id, osm_type, display_name
        )
        VALUES (
            'TestCity', 'TestProvince', 'TestCountry',
            ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint(139.0, 35.0), 4326)::geometry, 0.1))::geography,
            ST_SetSRID(ST_MakePoint(139.0, 35.0), 4326)::geography,
            9999999, 'relation', 'TestCity, TestProvince, TestCountry'
        )
        ON CONFLICT (osm_id, osm_type) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, osm_id, osm_type, name, province
    `);
    return result.rows[0];
}

async function cleanup() {
    await pool.query(`DELETE FROM artists WHERE name LIKE 'Test Artist%'`);
    await pool.query(`DELETE FROM city_boundaries WHERE osm_id = 9999999`);
}

async function main() {
    console.log('\n API Test\n');

    let testCity: any;
    let artistId: string;

    try {
        // 1. Setup test city
        console.log('→ Creating test city...');
        testCity = await setupTestCity();
        console.log(`Created: ${testCity.name} (OSM: ${testCity.osm_id})\n`);

        // 2. Test city search locally
        console.log('→ Testing city search...');
        const searchRes = await fetch(`${BASE_URL}/api/cities/search?q=test`);
        const searchData = await searchRes.json();
        console.log(`Found ${searchData.results.length} cities\n`);

        // 3. Test artist creation with OSM ID
        console.log('→ Creating artist with OSM ID...');
        const createRes = await fetch(`${BASE_URL}/api/artists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Artist',
                originalLocation: {
                    city: testCity.name,
                    province: testCity.province,
                    osmId: testCity.osm_id,
                    osmType: testCity.osm_type,
                    coordinates: { lat: 35.0, lng: 139.0 }
                },
                activeLocation: {
                    city: testCity.name,
                    province: testCity.province,
                    osmId: testCity.osm_id,
                    osmType: testCity.osm_type,
                    coordinates: { lat: 35.0, lng: 139.0 }
                }
            })
        });
        const artist = await createRes.json();
        artistId = artist.id;
        console.log(`Created: ${artist.name} (ID: ${artist.id})`);
        console.log(`City IDs: original=${artist.originalCityId}, active=${artist.activeCityId}\n`);

        // 4. Test get artist
        console.log('→ Getting artist...');
        const getRes = await fetch(`${BASE_URL}/api/artists/${artistId}`);
        const getArtist = await getRes.json();
        console.log(`Retrieved: ${getArtist.name}`);
        console.log(`Location: ${getArtist.originalLocation.city} → ${getArtist.activeLocation.city}\n`);

        console.log('All tests passed!\n');

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    } finally {
        await cleanup();
        await pool.end();
    }
}

main();
