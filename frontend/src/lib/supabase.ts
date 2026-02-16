import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Custom storage adapter that switches between localStorage and sessionStorage
const customStorage = {
    getItem: (key: string) => {
        // Check if session-only mode is active
        if (sessionStorage.getItem('session-only') === 'true') {
            return sessionStorage.getItem(key);
        }
        return localStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        if (sessionStorage.getItem('session-only') === 'true') {
            sessionStorage.setItem(key, value);
        } else {
            localStorage.setItem(key, value);
        }
    },
    removeItem: (key: string) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});
