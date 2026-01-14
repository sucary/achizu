import { Request, Response } from 'express';
import { ArtistService } from '../services/artistService';
import { CreateArtistDTO, UpdateArtistDTO, ArtistQueryParams, LocationView } from '../types/artist';
import { isValidLocation, isValidSocialLinks } from '../types/validation';

export const getAllArtists = async (req: Request, res: Response) => {
    try {
        const filters: ArtistQueryParams = req.query;
        let artists = await ArtistService.getAll();

        if (filters.name) {
            const nameQuery = filters.name.toLowerCase();
            artists = artists.filter(a => a.name.toLowerCase().includes(nameQuery));
        }

        if (filters.city) {
            const cityQuery = filters.city.toLowerCase();
            artists = artists.filter(a => {
                const location = filters.view === 'active' ? a.activeLocation : a.originalLocation;
                return location.city.toLowerCase().includes(cityQuery);
            });
        }

        if (filters.province) {
            const provinceQuery = filters.province.toLowerCase();
            artists = artists.filter(a => {
                const location = filters.view === 'active' ? a.activeLocation : a.originalLocation;
                return location.province.toLowerCase().includes(provinceQuery);
            });
        }

        res.json(artists);
    } catch (error) {
        console.error('Error in getAllArtists:', error);
        res.status(500).json({ message: 'Database error' });
    }
};

export const getArtistById = async (req: Request, res: Response) => {
    try {
        const artist = await ArtistService.getById(req.params.id);
        if (!artist) {
            res.status(404).json({ message: 'Artist not found' });
            return;
        }
        res.json(artist);
    } catch (error) {
        console.error('Error in getArtistById:', error);
        res.status(500).json({ message: 'Database error' });
    }
};

export const createArtist = async (req: Request, res: Response) => {
    try {
        const data: CreateArtistDTO = req.body;

        // Validation
        if (!data.name || !data.originalLocation || !data.activeLocation) {
            res.status(400).json({ message: 'Missing required fields' });
            return;
        }

        if (!isValidLocation(data.originalLocation) || !isValidLocation(data.activeLocation)) {
            res.status(400).json({ message: 'Invalid location data' });
            return;
        }

        if (data.socialLinks && !isValidSocialLinks(data.socialLinks)) {
            res.status(400).json({ message: 'Invalid social links' });
            return;
        }

        const newArtist = await ArtistService.create(data);
        res.status(201).json(newArtist);
    } catch (error) {
        console.error('Error in createArtist:', error);
        // Check if it's a known error (e.g. from CityService)
        if (error instanceof Error && error.message.includes('City not found')) {
            res.status(400).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: 'Database error' });
    }
};

export const updateArtist = async (req: Request, res: Response) => {
    try {
        const data: UpdateArtistDTO = req.body;

        // Validation for provided fields
        if (data.originalLocation && !isValidLocation(data.originalLocation)) {
            res.status(400).json({ message: 'Invalid original location data' });
            return;
        }

        if (data.activeLocation && !isValidLocation(data.activeLocation)) {
            res.status(400).json({ message: 'Invalid active location data' });
            return;
        }

        if (data.socialLinks && !isValidSocialLinks(data.socialLinks)) {
            res.status(400).json({ message: 'Invalid social links' });
            return;
        }

        const updatedArtist = await ArtistService.update(req.params.id, data);
        if (!updatedArtist) {
            res.status(404).json({ message: 'Artist not found' });
            return;
        }

        res.json(updatedArtist);
    } catch (error) {
        console.error('Error in updateArtist:', error);
        if (error instanceof Error && error.message.includes('City not found')) {
            res.status(400).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: 'Database error' });
    }
};

export const deleteArtist = async (req: Request, res: Response) => {
    try {
        const success = await ArtistService.delete(req.params.id);
        if (!success) {
            res.status(404).json({ message: 'Artist not found' });
            return;
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error in deleteArtist:', error);
        res.status(500).json({ message: 'Database error' });
    }
};

export const getArtistCountByCity = async (req: Request, res: Response) => {
    try {
        const view = (req.query.view as LocationView) || 'active';
        if (view !== 'original' && view !== 'active') {
            res.status(400).json({ message: 'Invalid view parameter. Use "original" or "active"' });
            return;
        }

        const counts = await ArtistService.countByCity(view);
        res.json(counts);
    } catch (error) {
        console.error('Error in getArtistCountByCity:', error);
        res.status(500).json({ message: 'Database error' });
    }
};