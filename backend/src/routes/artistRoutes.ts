import { Router } from 'express';
import {
    getAllArtists,
    getArtistById,
    createArtist,
    updateArtist,
    deleteArtist,
    getArtistCountByCity
} from '../controllers/artistController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getAllArtists);
router.get('/stats/by-city', getArtistCountByCity);
router.get('/:id', getArtistById);

// Protected routes
router.post('/', requireAuth, createArtist);
router.put('/:id', requireAuth, updateArtist);
router.delete('/:id', requireAuth, deleteArtist);

export default router;