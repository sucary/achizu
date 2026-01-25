import pool from '../config/database';

async function listArtists() {
    try {
        const result = await pool.query(`
            SELECT
                name,
                original_city,
                active_city,
                ST_AsText(original_display_coordinates) as original_display,
                ST_AsText(active_display_coordinates) as active_display
            FROM artists
            ORDER BY created_at DESC
        `);
        
        console.log('\n=== ARTISTS ===');
        console.table(result.rows.map(r => ({
            Name: r.name,
            'Original City': r.original_city,
            'Active City': r.active_city,
            'Display Loc (Active)': r.active_display
        })));
        console.log(`Total: ${result.rowCount}`);
    } catch (error) {
        console.error('Error listing artists:', error);
    }
}

async function listCities() {
    try {
        const result = await pool.query(`
            SELECT
                name,
                province,
                country,
                ST_AsText(center) as center,
                last_updated
            FROM city_boundaries
            ORDER BY name ASC
        `);

        console.log('\n=== CITIES ===');
        console.table(result.rows.map(r => ({
            Name: r.name,
            Province: r.province,
            Country: r.country,
            Center: r.center,
            'Last Updated': r.last_updated
        })));
        console.log(`Total: ${result.rowCount}`);
    } catch (error) {
        console.error('Error listing cities:', error);
    }
}

async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('Database connected successfully!');
        console.log('Current time from DB:', result.rows[0].now);

        const postgisVersion = await pool.query('SELECT PostGIS_version()');
        console.log('PostGIS version:', postgisVersion.rows[0].postgis_version);
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
}

async function main() {
    const command = process.argv[2];

    await testConnection();

    if (command === 'artists') {
        await listArtists();
    } else if (command === 'cities') {
        await listCities();
    } else {
        console.log('\nUsage:');
        console.log('  npm run test:db artists  - List all artists');
        console.log('  npm run test:db cities   - List all cities');
    }

    process.exit(0);
}

main();
