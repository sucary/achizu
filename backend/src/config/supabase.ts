import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client - bypasses RLS, use only on backend
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function verifySupabaseConnection() {
    try {
        const { data, error } = await supabaseAdmin.auth.getUser();
        if (error && error.message !== 'invalid claim: missing sub claim') {
            // This error is expected when no user token is provided
            console.log('Supabase Auth: Connected');
        }
        return { success: true };
    } catch (error) {
        console.error('Supabase connection failed:', error);
        return { success: false };
    }
}
