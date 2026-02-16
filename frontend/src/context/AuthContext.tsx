import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/profile';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    profile: Profile | null;
    signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithGitHub: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<Profile | null>(null);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            fetchProfile();
        } else {
            setProfile(null);
        }
    }, [user]);

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
        await supabase.auth.signOut();
        sessionStorage.removeItem('session-only');
    };

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
    };

    const signInWithGitHub = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: window.location.origin,
            },
        });
    };

    const fetchProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch('http://localhost:3000/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setProfile(data);
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    };

    const value = {
        user,
        session,
        loading,
        profile,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        signInWithGitHub,
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
