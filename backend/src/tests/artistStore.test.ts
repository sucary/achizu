import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { initTestDb, cleanupTestDb, closeTestDb, getPool } from './setup';

// ArtistStore imported dynamically to avoid hoisting issues
let ArtistStore: Awaited<typeof import('../models/artistStore')>['ArtistStore'];

beforeAll(async () => {
    await initTestDb();
    // Dynamic import AFTER env is loaded via initTestDb
    const module = await import('../models/artistStore');
    ArtistStore = module.ArtistStore;
});

afterEach(async () => {
    await cleanupTestDb();
});

afterAll(async () => {
    await closeTestDb();
});

describe('ArtistStore', () => {
    let tokyoId: string;
    let osakaId: string;
    let kyotoId: string;
    let yokohamaId: string;
    let testUserId: string;

    // Create dummy cities
    const createCity = async (name: string, province: string, lat: number, lng: number, osmId: number) => {
        const pool = await getPool();
        const result = await pool.query(`
            INSERT INTO locations (name, province, boundary, center, osm_id, osm_type)
            VALUES (
                $1,
                $2,
                ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($4, $3), 4326)::geometry, 0.1))::geography,
                ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
                $5,
                'relation'
            )
            RETURNING id
        `, [name, province, lat, lng, osmId]);
        return result.rows[0].id;
    };

    beforeAll(async () => {
        tokyoId = await createCity('Tokyo', 'Tokyo', 35.6762, 139.6503, 1000001);
        osakaId = await createCity('Osaka', 'Osaka', 34.6937, 135.5023, 1000002);
        kyotoId = await createCity('Kyoto', 'Kyoto', 35.0116, 135.7681, 1000003);
        yokohamaId = await createCity('Yokohama', 'Kanagawa', 35.4437, 139.6380, 1000004);
        // Use a fixed UUID for test user
        testUserId = '00000000-0000-0000-0000-000000000001';
    });

    const getTestArtist = () => ({
        userId: testUserId,
        name: 'Test Artist',
        originalLocation: {
            city: 'Tokyo',
            province: 'Tokyo',
            coordinates: { lat: 35.6762, lng: 139.6503 },
        },
        activeLocation: {
            city: 'Osaka',
            province: 'Osaka',
            coordinates: { lat: 34.6937, lng: 135.5023 },
        },
        originalCityId: tokyoId,
        activeCityId: osakaId,
        originalLocationDisplayCoordinates: { lat: 35.6762, lng: 139.6503 },
        activeLocationDisplayCoordinates: { lat: 34.6937, lng: 135.5023 }
    });

    describe('getAll', () => {
        it('returns empty array when no artists', async () => {
            const result = await ArtistStore.getAll();
            expect(result).toEqual([]);
        });
    });

    describe('create', () => {
        it('creates artist with correct coordinates', async () => {
            const created = await ArtistStore.create(getTestArtist());

            expect(created.name).toBe('Test Artist');
            expect(created.originalLocation.coordinates.lat).toBeCloseTo(35.6762);
            expect(created.originalLocation.coordinates.lng).toBeCloseTo(139.6503);
        });
    });

    describe('countByCity', () => {
        it('returns empty array when no artists', async () => {
            const result = await ArtistStore.countByCity();
            expect(result).toEqual([]);
        });

        it('returns correct counts by active city', async () => {
            const baseArtist = getTestArtist();
            await ArtistStore.create(baseArtist);
            await ArtistStore.create({
                ...baseArtist,
                name: 'Test Artist 2',
            });
            await ArtistStore.create({
                ...baseArtist,
                name: 'Test Artist 3',
                activeLocation: {
                    city: 'Kyoto',
                    province: 'Kyoto',
                    coordinates: { lat: 35.0116, lng: 135.7681 },
                },
                activeCityId: kyotoId,
                activeLocationDisplayCoordinates: { lat: 35.0116, lng: 135.7681 }
            });

            const result = await ArtistStore.countByCity('active');
            expect(result).toHaveLength(2);
            expect(result.find(r => r.location === 'Osaka')?.count).toBe(2);
            expect(result.find(r => r.location === 'Kyoto')?.count).toBe(1);
        });

        it('returns correct counts by original city', async () => {
            const baseArtist = getTestArtist();
            await ArtistStore.create(baseArtist);
            await ArtistStore.create({
                ...baseArtist,
                name: 'Test Artist 2',
                originalLocation: {
                    city: 'Yokohama',
                    province: 'Kanagawa',
                    coordinates: { lat: 35.4437, lng: 139.6380 },
                },
                originalCityId: yokohamaId,
                originalLocationDisplayCoordinates: { lat: 35.4437, lng: 139.6380 }
            });

            const result = await ArtistStore.countByCity('original');
            expect(result).toHaveLength(2);
            expect(result.find(r => r.location === 'Tokyo')?.count).toBe(1);
            expect(result.find(r => r.location === 'Yokohama')?.count).toBe(1);
        });
    });
});