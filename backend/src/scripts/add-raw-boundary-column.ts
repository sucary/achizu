import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import pool from '../config/database';

async function addRawBoundaryColumn() {
    const client = await pool.connect();
    try {
        console.log('Adding raw_boundary column to city_boundaries table...');
        
        await client.query(`
            ALTER TABLE city_boundaries 
            ADD COLUMN IF NOT EXISTS raw_boundary GEOGRAPHY(MULTIPOLYGON, 4326);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_city_boundaries_raw_boundary 
            ON city_boundaries USING GIST(raw_boundary);
        `);

        console.log('Successfully added raw_boundary column.');
    } catch (error) {
        console.error('Error adding column:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

addRawBoundaryColumn();