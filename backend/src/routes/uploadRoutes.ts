import { Router, Response } from 'express';
import { requireAuth, requireApproval, AuthenticatedRequest } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import cloudinary from '../config/cloudinary';

const router = Router();

/**
 * POST /api/upload/signature
 * Generates a signed set of Cloudinary upload parameters.
 * Requires authenticated + approved user.
 */
router.post(
    '/signature',
    requireAuth,
    requireApproval,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const timestamp = Math.round(Date.now() / 1000);
        const folder = 'artist_uploads';

        const paramsToSign = {
            timestamp,
            folder,
        };

        const signature = cloudinary.utils.api_sign_request(
            paramsToSign,
            process.env.CLOUDINARY_API_SECRET!
        );

        res.json({
            signature,
            timestamp,
            folder,
            apiKey: process.env.CLOUDINARY_API_KEY,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        });
    })
);

export default router;
