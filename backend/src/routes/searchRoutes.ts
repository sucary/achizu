import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { SearchService } from '../services/searchService';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many search requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// GET /api/search - Unified search across artists, locations, and users
router.get('/', searchLimiter, asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;
    const source = (req.query.source as 'auto' | 'nominatim') || 'auto';

    if (!query || query.trim().length < 2) {
        throw new AppError('Query must be at least 2 characters', 400);
    }

    const results = await SearchService.search(query.trim(), limit, source);
    res.json(results);
}));

export default router;
