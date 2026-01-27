import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'artist_map',
    password: process.env.DB_PASSWORD || 'testpassword',
    port: parseInt(process.env.DB_PORT || '5432'),
});

// Connection tests
pool.on('connect', () => {
    console.log('Yes, good. Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('No, not okay. Unexpected error on idle client', err);
    process.exit(-1);
});


export async function verifyDatabaseConnection() {
    try {
        const result = await pool.query('SELECT version() as version');
        const version = result.rows[0].version;
        const dbType = version.includes('PostgreSQL 15') ? '🐳 DOCKER' : '💻 LOCAL';
        console.log(`Database: ${dbType} - ${version.split(',')[0]}`);
        return { success: true };
    } catch (error) {
        console.error('Database connection failed:', error);
        return { success: false };
    }
}

export default pool;
