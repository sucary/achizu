import pool, { verifyDatabaseConnection } from '../config/database';
import * as shapefile from 'shapefile';
import path from 'path';

async function importOceanData() {
    await verifyDatabaseConnection();

    const customPath = process.argv[2];
    const shapefilePath = customPath
        ? path.resolve(customPath)
        : path.join(__dirname, '../../data/ne_10m_ocean.shp');

    console.log('Starting import of ocean data from:', shapefilePath);

    const client = await pool.connect();
    
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS water_polygons (
                gid SERIAL PRIMARY KEY,
                geom GEOGRAPHY(MULTIPOLYGON, 4326)
            );
            CREATE INDEX IF NOT EXISTS idx_water_polygons_geom ON water_polygons USING GIST(geom);
        `);

        console.log('Clearing existing water polygons...');
        await client.query('TRUNCATE TABLE water_polygons RESTART IDENTITY');

        console.log('Reading shapefile and inserting...');
        let count = 0;
        
        const source = await shapefile.open(shapefilePath);
        
        while (true) {
            const result = await source.read();
            if (result.done) break;
            
            const feature = result.value;
            
            if (feature.geometry) {
                await client.query(`
                    INSERT INTO water_polygons (geom)
                    VALUES (
                        ST_Multi(
                            ST_SetSRID(
                                ST_GeomFromGeoJSON($1), 
                                4326
                            )
                        )::geography
                    )
                `, [JSON.stringify(feature.geometry)]);
                
                count++;
                if (count % 100 === 0) process.stdout.write(`\rImported ${count} polygons...`);
            }
        }
        
        console.log(`\nSuccessfully imported ${count} ocean polygons.`);
        
    } catch (error) {
        console.error('Error importing ocean data:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

importOceanData();