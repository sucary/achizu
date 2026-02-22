import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware';
import {
    checkUsernameAvailability,
    checkEmailAvailability,
    getProfile,
    getPendingUsers,
    approveUser,
    rejectUser,
} from '../controllers/authController';
import { ProfileStore } from '../models/profileStore';
import pool from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Public routes
router.get('/check-username', checkUsernameAvailability);
router.get('/check-email', checkEmailAvailability);

// Protected routes
router.get('/profile', requireAuth, getProfile);

// Admin routes
router.get('/admin/pending-users', requireAuth, requireAdmin, getPendingUsers);
router.post('/admin/approve/:userId', requireAuth, requireAdmin, approveUser);
router.post('/admin/reject/:userId', requireAuth, requireAdmin, rejectUser);

// POST /api/auth/set-username
router.post('/set-username', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { username } = req.body;
    const userId = req.user!.id;

    // Validate username format
    if (!username || username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        res.status(400).json({ error: 'Username must be 3+ chars, letters/numbers/underscores only' });
        return;
    }

    // Check availability
    const available = await ProfileStore.checkUsernameAvailable(username);
    if (!available) {
        res.status(409).json({ error: 'Username already taken' });
        return;
    }

    // Update profile
    await pool.query('UPDATE profiles SET username = $1 WHERE id = $2', [username, userId]);
    res.json({ success: true });
}));

export default router;
