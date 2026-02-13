import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import pool from '../config/database';

export interface AuthUser {
    id: string;
    email: string;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}

/**
 * Middleware that requires authentication
 * Rejects request if no valid token provided
 */
export async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }

    const token = authHeader.substring(7);

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }

        req.user = {
            id: user.id,
            email: user.email || ''
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

/**
 * Middleware that optionally attaches user if token provided
 * Continues even without authentication
 */
export async function optionalAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.substring(7);

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (!error && user) {
            req.user = {
                id: user.id,
                email: user.email || ''
            };
        }
    } catch {
        // Silently continue without user
    }

    next();
}

/**
 * Middleware that requires user to be approved
 * Use after requireAuth
 */
export async function requireApproval(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const userId = req.user!.id;

    try {
        const result = await pool.query(
            `SELECT is_approved FROM profiles WHERE id = $1`,
            [userId]
        );

        const profile = result.rows[0];

        if (!profile || !profile.is_approved) {
            res.status(403).json({
                error: 'Account pending approval',
                message: 'Your account is awaiting admin approval. You will be notified once approved.'
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Approval check error:', error);
        res.status(500).json({ error: 'Failed to check approval status' });
    }
}

/**
 * Middleware that requires user to be admin
 * Use after requireAuth
 */
export async function requireAdmin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const userId = req.user!.id;

    try {
        const result = await pool.query(
            `SELECT is_admin FROM profiles WHERE id = $1`,
            [userId]
        );

        const profile = result.rows[0];

        if (!profile || !profile.is_admin) {
            res.status(403).json({
                error: 'Admin access required',
                message: 'You do not have permission to access this resource.'
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Failed to check admin status' });
    }
}
