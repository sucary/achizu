import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CityService } from '../services/cityService';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// Rate limiter
const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per window
    message: 'Too many search requests, please try 1 minute later.',
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/search', searchLimiter, asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query || query.trim().length < 2) {
        throw new AppError('Query must be at least 2 characters', 400);
    }

    // Search local DB and Nominatim in parallel
    const [priorityResults, localResults, nominatimResults] = await Promise.all([
        CityService.getPriorityLocations(query.trim()),
        CityService.searchLocal(query.trim(), limit),
        CityService.searchNominatim(query.trim(), limit)
    ]);

    // Mark local results with isLocal flag
    const localWithFlag = localResults.map(r => ({ ...r, isLocal: true }));
    const priorityWithFlag = priorityResults.map(r => ({ ...r, isLocal: true }));

    // Cross-reference Nominatim results with local DB
    const osmPairs = nominatimResults.map(r => ({ osmId: r.osmId, osmType: r.osmType }));
    const existingMap = await CityService.getExistingOsmIds(osmPairs);

    const nominatimWithFlag = nominatimResults.map(r => ({
        ...r,
        id: existingMap.get(`${r.osmId}:${r.osmType}`),
        isLocal: existingMap.has(`${r.osmId}:${r.osmType}`)
    }));

    // Combine: priority first, then local, then nominatim (deduplicated by osmId)
    const seenOsmIds = new Set<string>();
    const allResults = [...priorityWithFlag, ...localWithFlag, ...nominatimWithFlag];
    const combinedResults: Array<typeof allResults[number]> = [];

    for (const result of allResults) {
        const key = `${result.osmId}:${result.osmType}`;
        if (!seenOsmIds.has(key)) {
            seenOsmIds.add(key);
            combinedResults.push(result);
        }
    }

    res.json({
        results: combinedResults.slice(0, limit),
        source: 'combined'
    });
}));

router.post('/reverse', searchLimiter, asyncHandler(async (req, res) => {
    const { lat, lng } = req.body;
    const withBoundary = req.query.withBoundary === 'true';

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        throw new AppError('Valid lat and lng required', 400);
    }

    let city = await CityService.reverseGeocode(
        parseFloat(lat),
        parseFloat(lng)
    );

    if (!city) {
        throw new AppError('No city found at these coordinates', 404);
    }

    // If boundary requested and city not fully stored in DB, fetch and save
    if (withBoundary && !city.id) {
        // City was found via Nominatim reverse but not in DB
        // Fetch full data with boundary and save
        const nominatimData = await CityService.fetchByOsmId(city.osmId, city.osmType);
        if (nominatimData) {
            city = await CityService.saveFromNominatim(nominatimData);
        }
    } else if (withBoundary && city.id && !city.boundary) {
        // City exists in DB but boundary not loaded, fetch full data
        const fullCity = await CityService.getById(city.id);
        if (fullCity) {
            city = fullCity;
        }
    }

    res.json(city);
}));

// GET /api/cities/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const city = await CityService.getById(req.params.id);
    if (!city) {
        throw new AppError('City not found', 404);
    }
    res.json(city);
}));

export default router;
