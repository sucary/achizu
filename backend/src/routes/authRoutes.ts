import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';
import {
    checkUsernameAvailability,
    checkEmailAvailability,
    getProfile,
    getPendingUsers,
    approveUser,
    rejectUser,
} from '../controllers/authController';

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

export default router;
