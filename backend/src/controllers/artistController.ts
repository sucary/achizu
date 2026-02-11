import { Request, Response } from 'express';
import { ArtistService } from '../services/artistService';
import { ArtistQueryParams, LocationView } from '../types/artist';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ArtistInputSchema } from '../schemas/artistValidation';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

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

export const createArtist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = ArtistInputSchema.parse(req.body);
    const userId = req.user!.id;

    try {
        const newArtist = await ArtistService.create(data, userId);
        res.status(201).json(newArtist);
    } catch (error) {
        if (error instanceof Error && error.message.includes('City not found')) {
            throw new AppError(error.message, 400);
        }
        throw error;
    }
});

export const updateArtist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = ArtistInputSchema.partial().parse(req.body);
    const userId = req.user!.id;

    // Check ownership
    const artist = await ArtistService.getById(req.params.id);
    if (!artist) {
        throw new AppError('Artist not found', 404);
    }
    if (artist.userId && artist.userId !== userId) {
        throw new AppError('Not authorized to update this artist', 403);
    }

    try {
        const updatedArtist = await ArtistService.update(req.params.id, data);
        res.json(updatedArtist);
    } catch (error) {
        if (error instanceof Error && error.message.includes('City not found')) {
            throw new AppError(error.message, 400);
        }
        throw error;
    }
});

export const deleteArtist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Check ownership
    const artist = await ArtistService.getById(req.params.id);
    if (!artist) {
        throw new AppError('Artist not found', 404);
    }
    if (artist.userId && artist.userId !== userId) {
        throw new AppError('Not authorized to delete this artist', 403);
    }

    await ArtistService.delete(req.params.id);
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