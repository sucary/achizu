import { Router } from 'express';
import { CityService } from '../services/cityService';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// GET /api/cities/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const city = await CityService.getById(req.params.id);
    if (!city) {
        throw new AppError('City not found', 404);
    }
    res.json(city);
}));

export default router;
