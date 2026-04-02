import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { ArtistService } from '../services/artistService';
import pool, { verifyDatabaseConnection } from '../config/database';
import { CreateArtistDTO } from '../types/artist';


// Sample artist data to seed the database
// Hardcoded OSM IDs for cities, DOES NOT VERIFY FUZZY SEARCH!

const sampleArtists: CreateArtistDTO[] = [
    {
        name: "Snooty",
        sourceImage: undefined,
        originalLocation: {
            city: "Fukuoka",
            province: "Fukuoka",
            osmId: 4008611,
            osmType: "relation",
            coordinates: { lat: 33.5902, lng: 130.4017 }
        },
        activeLocation: {
            city: "Fukuoka",
            province: "Fukuoka",
            osmId: 4008611,
            osmType: "relation",
            coordinates: { lat: 33.5902, lng: 130.4017 }
        },
        socialLinks: {
            instagram:"https://www.instagram.com/snooty_official_desu/"
        }
    },
    {
        name: "Unfair Rule",
        sourceImage: undefined,
        originalLocation: {
            city: "Okayama",
            province: "Okayama",
            osmId: 3939644,
            osmType: "relation",
            coordinates: { lat: 34.6551, lng: 133.9195 }
        },
        activeLocation: {
            city: "Tokyo",
            province: "Tokyo",
            osmId: 19631009,  // Tokyo 23 wards, the heart of the world
            osmType: "relation",
            coordinates: { lat: 35.6762, lng: 139.6503}
        },
        socialLinks: {
            instagram:"https://www.instagram.com/unfair_rule/"
        }
    }
];

/*
/ Generate dummy artists
/ Note: Coordinates are placeholders (0,0).
/ The backend will replace them with the official city center.
*/
const dummyCoords = { lat: 0, lng: 0 };

for (let i = 1; i <= 15; i++) {
    sampleArtists.push({
        name: `Tokyo Artist ${i}`,
        sourceImage: undefined,
        originalLocation: {
            city: "Tokyo",
            province: "Tokyo",
            osmId: 19631009,
            osmType: "relation",
            coordinates: dummyCoords
        },
        activeLocation: {
            city: "Tokyo",
            province: "Tokyo",
            osmId: 19631009,
            osmType: "relation",
            coordinates: dummyCoords
        },
        socialLinks: {}
    });
}

for (let i = 1; i <= 15; i++) {
    sampleArtists.push({
        name: `Kawasaki Artist ${i}`,
        sourceImage: undefined,
        originalLocation: {
            city: "Kawasaki",
            province: "Kanagawa",
            osmId: 2689476,
            osmType: "relation",
            coordinates: dummyCoords
        },
        activeLocation: {
            city: "Kawasaki",
            province: "Kanagawa",
            osmId: 2689476,
            osmType: "relation",
            coordinates: dummyCoords
        },
        socialLinks: {}
    });
}

async function seedDatabase() {
    try {
        await verifyDatabaseConnection();

        console.log('Starting database seed...');
        console.log('Note: This may take ~30-60 seconds due to Nominatim rate limits\n');

        // Get admin user to assign artists to
        const adminResult = await pool.query(
            `SELECT id FROM profiles WHERE is_admin = true LIMIT 1`
        );
        const adminUserId = adminResult.rows[0]?.id;

        if (!adminUserId) {
            console.error('No admin user found. Please create an admin user first.');
            process.exit(1);
        }

        console.log(`Using admin user: ${adminUserId}\n`);

        await pool.query('DELETE FROM artists');
        console.log('Cleared existing artists');
        await pool.query('DELETE FROM locations');
        console.log('Cleared existing cities\n');

        for (const artist of sampleArtists) {
            try {
                await ArtistService.create(artist, adminUserId);
                console.log(`Created artist: ${artist.name}`);
            } catch (err) {
                console.error(`Failed to create artist ${artist.name}:`, err);
            }
        }

        console.log('\nDatabase seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();