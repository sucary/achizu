import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

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
    } catch (error) {
        // Silently continue without user
    }

    next();
}
