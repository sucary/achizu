import { Router } from 'express';
import {
    getAllArtists,
    getArtistById,
    createArtist,
    updateArtist,
    deleteArtist,
    getArtistCountByCity
} from '../controllers/artistController';
import { requireAuth, requireApproval } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getAllArtists);
router.get('/stats/by-city', getArtistCountByCity);
router.get('/:id', getArtistById);

// Protected routes
router.post('/', requireAuth, requireApproval, createArtist);
router.put('/:id', requireAuth, requireApproval, updateArtist);
router.delete('/:id', requireAuth, requireApproval, deleteArtist);

export default router;