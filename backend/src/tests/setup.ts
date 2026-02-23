import dotenv from 'dotenv';
import path from 'path';

// Load test env with override BEFORE importing pool
dotenv.config({
    path: path.resolve(__dirname, '../../.env.test'),
    override: true
});

// ============================================
// SAFETY GUARD: Prevent tests from touching remote DB
// ============================================
function verifyLocalDatabase() {
    const dbUrl = process.env.DATABASE_URL;
    const dbHost = process.env.DB_HOST;

    // Check 1: DATABASE_URL should be empty or undefined
    if (dbUrl && dbUrl.trim() !== '') {
        console.error('\n🚨 SAFETY GUARD TRIGGERED 🚨');
        console.error('DATABASE_URL is set:', dbUrl.substring(0, 30) + '...');
        console.error('Tests must run against local database only!');
        console.error('Check your .env.test file has: DATABASE_URL=');
        process.exit(1);
    }

    // Check 2: DB_HOST should be localhost
    if (dbHost && !['localhost', '127.0.0.1'].includes(dbHost)) {
        console.error('\n🚨 SAFETY GUARD TRIGGERED 🚨');
        console.error('DB_HOST is not localhost:', dbHost);
        console.error('Tests must run against local database only!');
        process.exit(1);
    }

    console.log('✓ Safety check passed: Using local test database');
}

verifyLocalDatabase();

import pool from '../config/database';
import fs from 'fs';

export async function initTestDb() {
    // Use test schema (has local users table instead of Supabase auth.users)
    const schema = fs.readFileSync(
        path.resolve(__dirname, '../db/schema.test.sql'),
        'utf-8'
    );
    await pool.query(schema);
}

export async function cleanupTestDb() {
    await pool.query('TRUNCATE artists RESTART IDENTITY CASCADE');
}

export async function closeTestDb() {
    await pool.end();
}