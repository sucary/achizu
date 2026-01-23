import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { ArtistService } from '../services/artistService';
import pool from '../config/database';
import { CreateArtistDTO } from '../types/artist';

// Sample artist data to seed the database

const sampleArtists: CreateArtistDTO[] = [
    {
        name: "Snooty",
        profilePicture: undefined,
        originalLocation: {
            city: "Fukuoka",
            province: "Fukuoka",
            coordinates: { lat: 33.5902, lng: 130.4017 }
        },
        activeLocation: {
            city: "Fukuoka",
            province: "Fukuoka",
            coordinates: { lat: 33.5902, lng: 130.4017 }
        },
        socialLinks: {
            instagram:"https://www.instagram.com/snooty_official_desu/"
        }
    },
    {
        name: "Unfair Rule",
        profilePicture: undefined,
        originalLocation: {
            city: "Okayama",
            province: "Okayama",
            coordinates: { lat: 34.6551, lng: 133.9195 }
        },
        activeLocation: {
            city: "Tokyo",
            province: "Tokyo",
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
        profilePicture: undefined,
        originalLocation: {
            city: "Tokyo",
            province: "Tokyo",
            coordinates: dummyCoords
        },
        activeLocation: {
            city: "Tokyo",
            province: "Tokyo",
            coordinates: dummyCoords
        },
        socialLinks: {}
    });
}

for (let i = 1; i <= 15; i++) {
    sampleArtists.push({
        name: `Kawasaki Artist ${i}`,
        profilePicture: undefined,
        originalLocation: {
            city: "Kawasaki",
            province: "Kanagawa",
            coordinates: dummyCoords
        },
        activeLocation: {
            city: "Kawasaki",
            province: "Kanagawa",
            coordinates: dummyCoords
        },
        socialLinks: {}
    });
}

async function seedDatabase() {
try {
    console.log('Starting database seed...');
    
    await pool.query('DELETE FROM artists');
    console.log('Cleared existing artists');
    await pool.query('DELETE FROM city_boundaries');
    console.log('Cleared existing cities');

    for (const artist of sampleArtists) {
        try {
            await ArtistService.create(artist);
            console.log(`Created artist: ${artist.name}`);
        } catch (err) {
            console.error(`Failed to create artist ${artist.name}:`, err);
        }
    }

    console.log('Database seeded successfully!');
    process.exit(0);
} catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
}
}

seedDatabase();