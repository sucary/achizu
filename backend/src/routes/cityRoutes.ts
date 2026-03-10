import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CityService } from '../services/cityService';
import { TextSearch, ReverseSearch } from '../services/searchHelper';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { CoordinatesSchema } from '../schemas/artistValidation';

const router = Router();

const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many search requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// GET /api/cities/search - Text-based location search
router.get('/search', searchLimiter, asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const source = (req.query.source as string || 'auto') as 'auto' | 'local' | 'nominatim';

    if (!query || query.trim().length < 2) {
        throw new AppError('Query must be at least 2 characters', 400);
    }

    console.log(`[SEARCH] Text search: "${query.trim()}" (source: ${source}, limit: ${limit})`);

    const result = await TextSearch.search(query.trim(), limit, source);

    console.log(`[SEARCH] Results: ${result.results.length} from ${result.source}, hasMore: ${result.hasMore}`);

    res.json(result);
}));

// POST /api/cities/reverse/search - Coordinate-based search (multiple results)
router.post('/reverse/search', searchLimiter, asyncHandler(async (req, res) => {
    const { lat, lng } = CoordinatesSchema.parse(req.body);
    const limit = parseInt(req.query.limit as string) || 50;
    const source = (req.query.source as string || 'auto') as 'auto' | 'nominatim';

    console.log(`[SEARCH] Reverse search: (${lat}, ${lng}) (source: ${source}, limit: ${limit})`);

    const result = await ReverseSearch.search(lat, lng, limit, source);

    if (result.results.length === 0) {
        throw new AppError('No location found at these coordinates', 404);
    }

    console.log(`[SEARCH] Reverse results: ${result.results.length} from ${result.source}`);

    res.json(result);
}));

// POST /api/cities/reverse - Simple reverse geocode (single result)
router.post('/reverse', searchLimiter, asyncHandler(async (req, res) => {
    const { lat, lng } = CoordinatesSchema.parse(req.body);
    const withBoundary = req.query.withBoundary === 'true';

    let city = await CityService.reverseGeocode(lat, lng);

    if (!city) {
        throw new AppError('No city found at these coordinates', 404);
    }

    if (withBoundary && !city.id) {
        // City found via Nominatim but not in DB - fetch and save
        const nominatimData = await CityService.fetchByOsmId(city.osmId, city.osmType);
        if (nominatimData) {
            city = await CityService.saveFromNominatim(nominatimData);
        }
    } else if (withBoundary && city.id && !city.boundary) {
        // City in DB but boundary not loaded
        const fullCity = await CityService.getById(city.id);
        if (fullCity) {
            city = fullCity;
        }
    }

    res.json(city);
}));

// GET /api/cities/:id - Get city by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const city = await CityService.getById(req.params.id);
    if (!city) {
        throw new AppError('City not found', 404);
    }
    res.json(city);
}));

export default router;
