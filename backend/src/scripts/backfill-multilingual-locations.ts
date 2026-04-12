import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pool from '../config/database';
import { LocationLocalizationService } from '../services/locationLocalizationService';

/**
 * One-shot backfill script: walks every `locations` row that is referenced
 * by an artist FK (original_city_id or active_city_id) and is not yet
 * localized, and runs LocationLocalizationService.ensureLocalized on it.
 *
 * Properties:
 *   - Idempotent. ensureLocalized short-circuits when localized_at is set,
 *     so re-running picks up where the previous run left off (or after a
 *     transient Overpass outage).
 *   - Most-referenced cities first, so user-visible payoff comes early.
 *   - Throttled to ~1 row/sec to avoid hammering Overpass / LocationIQ.
 *   - Per-row retry with backoff (up to MAX_ATTEMPTS), then logged and
 *     skipped — re-running the script picks them up again later.
 *   - Graceful Ctrl+C: finishes the current row and exits cleanly.
 *
 * Flags:
 *   --dry-run    List the rows that would be processed and exit.
 *   --limit=N    Cap the number of rows processed in this run.
 *
 * Usage:
 *   DATABASE_URL=... ts-node src/scripts/backfill-multilingual-locations.ts
 *   ts-node src/scripts/backfill-multilingual-locations.ts --dry-run
 *   ts-node src/scripts/backfill-multilingual-locations.ts --limit=10
 *
 * See plans/multilingual_locations_plan.md (PR 3).
 */

const THROTTLE_MS = 1100; // ~1 row/sec
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;

interface BackfillRow {
    id: string;
    name: string;
    osm_id: string;
    osm_type: string;
    ref_count: number;
}

interface FailureRecord {
    locationId: string;
    name: string;
    osmId: string;
    osmType: string;
    attempts: number;
    lastError: string;
}

let shutdownRequested = false;

function parseArgs() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    let limit: number | undefined;
    for (const arg of args) {
        const m = arg.match(/^--limit=(\d+)$/);
        if (m) limit = parseInt(m[1], 10);
    }
    return { dryRun, limit };
}

async function fetchTargets(limit?: number): Promise<BackfillRow[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const result = await pool.query(`
        SELECT
            l.id,
            l.name,
            l.osm_id,
            l.osm_type,
            COUNT(refs.id)::int AS ref_count
        FROM locations l
        JOIN (
            SELECT original_city_id AS id FROM artists WHERE original_city_id IS NOT NULL
            UNION ALL
            SELECT active_city_id   AS id FROM artists WHERE active_city_id   IS NOT NULL
        ) refs ON refs.id = l.id
        WHERE l.localized_at IS NULL
        GROUP BY l.id, l.name, l.osm_id, l.osm_type
        ORDER BY ref_count DESC, l.name ASC
        ${limitClause}
    `);
    return result.rows as BackfillRow[];
}

async function processOne(row: BackfillRow): Promise<{ ok: boolean; attempts: number; lastError?: string }> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const result = await LocationLocalizationService.ensureLocalized(row.id);
            if (result) {
                return { ok: true, attempts: attempt };
            }
            // ensureLocalized swallows errors and returns null on failure.
            lastError = 'ensureLocalized returned null (both providers failed or row missing)';
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
        }

        if (attempt < MAX_ATTEMPTS) {
            await sleep(RETRY_BACKOFF_MS * attempt);
        }
    }

    return { ok: false, attempts: MAX_ATTEMPTS, lastError };
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function targetSummary(): string {
    if (process.env.DATABASE_URL) {
        const url = process.env.DATABASE_URL;
        // Strip credentials before printing.
        const masked = url.replace(/\/\/[^@]+@/, '//***:***@');
        return `Supabase / remote (${masked})`;
    }
    return `local (${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${process.env.DB_NAME ?? 'artist_map'})`;
}

function writeFailureReport(failures: FailureRecord[]) {
    if (failures.length === 0) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backfill-failures-${stamp}.json`;
    const filepath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(filepath, JSON.stringify(failures, null, 2));
    return filepath;
}

async function main() {
    const { dryRun, limit } = parseArgs();

    console.log('=== Multilingual locations backfill ===');
    console.log(`Target DB:  ${targetSummary()}`);
    console.log(`Dry run:    ${dryRun ? 'YES' : 'no'}`);
    if (limit) console.log(`Limit:      ${limit}`);
    console.log('');

    const targets = await fetchTargets(limit);
    console.log(`Found ${targets.length} un-localized location(s) referenced by artists.\n`);

    if (targets.length === 0) {
        console.log('Nothing to do. Exiting.');
        return;
    }

    if (dryRun) {
        console.log('Would process (in order):');
        for (const row of targets) {
            console.log(`  [refs=${row.ref_count}] ${row.name}  (${row.osm_type}/${row.osm_id})  id=${row.id}`);
        }
        console.log('\nDry run complete. No changes made.');
        return;
    }

    // Graceful shutdown.
    process.on('SIGINT', () => {
        console.log('\n[backfill] SIGINT received — finishing current row and exiting.');
        shutdownRequested = true;
    });

    let success = 0;
    let failed = 0;
    const failures: FailureRecord[] = [];

    for (let i = 0; i < targets.length; i++) {
        if (shutdownRequested) {
            console.log(`[backfill] Stopped early after ${i} of ${targets.length} rows.`);
            break;
        }

        const row = targets[i];
        const tag = `[${i + 1}/${targets.length}] [refs=${row.ref_count}]`;
        process.stdout.write(`${tag} ${row.name} (${row.osm_type}/${row.osm_id}) ... `);

        const result = await processOne(row);

        if (result.ok) {
            console.log(`OK (attempts=${result.attempts})`);
            success++;
        } else {
            console.log(`FAIL (attempts=${result.attempts}): ${result.lastError}`);
            failed++;
            failures.push({
                locationId: row.id,
                name: row.name,
                osmId: row.osm_id,
                osmType: row.osm_type,
                attempts: result.attempts,
                lastError: result.lastError ?? 'unknown',
            });
        }

        if (i < targets.length - 1) {
            await sleep(THROTTLE_MS);
        }
    }

    console.log('\n=== Summary ===');
    console.log(`Success: ${success}`);
    console.log(`Failed:  ${failed}`);

    const reportPath = writeFailureReport(failures);
    if (reportPath) {
        console.log(`\nFailure report written to: ${reportPath}`);
        console.log('Re-running the script will retry these rows automatically.');
    }
}

main()
    .then(async () => {
        await pool.end();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error('\nFATAL:', err);
        await pool.end();
        process.exit(1);
    });
