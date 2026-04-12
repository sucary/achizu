import pool from '../config/database';

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  isAdmin: boolean;
  isApproved: boolean;
  isPrivate: boolean;
  locationLanguage: string;
}

export interface PendingUser {
    id: string;
    email: string;
    username: string | null;
    createdAt: Date;
}

export const ProfileStore = {
    getByUserId: async (userId: string): Promise<Profile | null> => {
        const result = await pool.query(
            `SELECT id, email, username, is_admin as "isAdmin", is_approved as "isApproved", is_private as "isPrivate", location_language as "locationLanguage"
              FROM profiles WHERE id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    },

    updateProfile: async (userId: string, updates: { username?: string; isPrivate?: boolean; locationLanguage?: string }): Promise<void> => {
        const setClauses: string[] = [];
        const values: (string | boolean)[] = [];
        let paramIndex = 1;

        if (updates.username !== undefined) {
            setClauses.push(`username = $${paramIndex++}`);
            values.push(updates.username);
        }
        if (updates.isPrivate !== undefined) {
            setClauses.push(`is_private = $${paramIndex++}`);
            values.push(updates.isPrivate);
        }
        if (updates.locationLanguage !== undefined) {
            setClauses.push(`location_language = $${paramIndex++}`);
            values.push(updates.locationLanguage);
        }

        if (setClauses.length === 0) return;

        values.push(userId);
        await pool.query(
            `UPDATE profiles SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
            values
        );
    },

    checkUsernameAvailable: async (username: string): Promise<boolean> => {
        const result = await pool.query(
            `SELECT 1 FROM profiles WHERE username = $1`,
            [username]
        );
        return result.rows.length === 0;
    },

    checkEmailAvailable: async (email: string): Promise<boolean> => {
        const result = await pool.query(
            `SELECT 1 FROM profiles WHERE email = $1`,
            [email]
        );
        return result.rows.length === 0;
    },

    getPendingUsers: async (): Promise<PendingUser[]> => {
        const result = await pool.query(
            `SELECT id, email, username, created_at as "createdAt"
             FROM profiles
             WHERE is_approved = false
             ORDER BY created_at DESC`
        );
        return result.rows;
    },

    approveUser: async (userId: string): Promise<void> => {
        await pool.query(
            `UPDATE profiles SET is_approved = true WHERE id = $1`,
            [userId]
        );
    },

    rejectUser: async (userId: string): Promise<void> => {
        // Delete user from auth.users (cascade will delete profile)
        await pool.query(
            `DELETE FROM auth.users WHERE id = $1`,
            [userId]
        );
    },
};
