import { Request, Response } from 'express';
import { ArtistService } from '../services/artistService';
import { ArtistQueryParams, LocationView } from '../types/artist';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ArtistInputSchema } from '../schemas/artistValidation';

export const getAllArtists = asyncHandler(async (req: Request, res: Response) => {
    const filters: ArtistQueryParams = {
        name: req.query.name as string,
        city: req.query.city as string,
        province: req.query.province as string,
        view: req.query.view as LocationView
    };

    const artists = await ArtistService.getAll(filters);
    res.json(artists);
});

export const getArtistById = asyncHandler(async (req: Request, res: Response) => {
    const artist = await ArtistService.getById(req.params.id);
    if (!artist) {
        throw new AppError('Artist not found', 404);
    }
    res.json(artist);
});

export const createArtist = asyncHandler(async (req: Request, res: Response) => {
    const data = ArtistInputSchema.parse(req.body);

    try {
        const newArtist = await ArtistService.create(data);
        res.status(201).json(newArtist);
    } catch (error) {
        if (error instanceof Error && error.message.includes('City not found')) {
            throw new AppError(error.message, 400);
        }
        throw error;
    }
});

export const updateArtist = asyncHandler(async (req: Request, res: Response) => {
    // Allow partial updates
    const data = ArtistInputSchema.partial().parse(req.body);

    try {
        const updatedArtist = await ArtistService.update(req.params.id, data);
        if (!updatedArtist) {
            throw new AppError('Artist not found', 404);
        }

        res.json(updatedArtist);
    } catch (error) {
        if (error instanceof Error && error.message.includes('City not found')) {
            throw new AppError(error.message, 400);
        }
        throw error;
    }
});

export const deleteArtist = asyncHandler(async (req: Request, res: Response) => {
    const success = await ArtistService.delete(req.params.id);
    if (!success) {
        throw new AppError('Artist not found', 404);
    }
    res.status(204).send();
});

export const getArtistCountByCity = asyncHandler(async (req: Request, res: Response) => {
    const view = (req.query.view as LocationView) || 'active';
    if (view !== 'original' && view !== 'active') {
        throw new AppError('Invalid view parameter. Use "original" or "active"', 400);
    }

    const counts = await ArtistService.countByCity(view);
    res.json(counts);
});