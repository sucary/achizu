import pool from '../config/database';

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  isAdmin: boolean;
  isApproved: boolean;
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
            `SELECT id, email, username, is_admin as "isAdmin", is_approved as "isApproved"
              FROM profiles WHERE id = $1`,
            [userId]
        );
        return result.rows[0] || null;
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
