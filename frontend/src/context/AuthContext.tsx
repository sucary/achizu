import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { API_URL } from '../services/api';
import type { Profile } from '../types/profile';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    profile: Profile | null;
    signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    signInWithOAuth: (provider: 'google' | 'github') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const queryClient = useQueryClient();

    const user = session?.user ?? null;

    // Profile fetching
    const { data: profile = null } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!session) return null;
            const response = await fetch(`${API_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });
            if (response.status === 401) {
                await supabase.auth.signOut();
                return null;
            }
            if (!response.ok) return null;
            return response.json() as Promise<Profile>;
        },
        enabled: !!user,
    });

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session);
                setLoading(false);

                // Only refetch on actual login, not logout
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    queryClient.invalidateQueries({ queryKey: ['artists'] });
                    queryClient.invalidateQueries({ queryKey: ['profile'] });
                } else if (event === 'SIGNED_OUT') {
                    // Clear cached data on logout
                    queryClient.removeQueries({ queryKey: ['artists'] });
                    queryClient.removeQueries({ queryKey: ['profile'] });
                    queryClient.removeQueries({ queryKey: ['pendingUsers'] });
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string, rememberMe = true) => {
        // Set storage mode BEFORE login so custom storage adapter uses the right storage
        if (!rememberMe) {
            sessionStorage.setItem('session-only', 'true');
        } else {
            sessionStorage.removeItem('session-only');
        }

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        return { error };
    };

    const signUp = async (email: string, password: string, username: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                },
            },
        });
        return { error };
    };

    const signOut = async () => {
        sessionStorage.removeItem('session-only');
        // Remove queries before signing out to prevent refetch with invalid token
        queryClient.removeQueries({ queryKey: ['profile'] });
        queryClient.removeQueries({ queryKey: ['artists'] });
        queryClient.removeQueries({ queryKey: ['pendingUsers'] });
        await supabase.auth.signOut();
    };

    const signInWithOAuth = async (provider: 'google' | 'github') => {
        await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin,
            },
        });
    };

    const value = {
        user,
        session,
        loading,
        profile,
        signIn,
        signUp,
        signOut,
        signInWithOAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
