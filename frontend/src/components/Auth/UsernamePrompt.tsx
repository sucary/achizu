import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Input, Button } from '../ui';
import { API_URL } from '../../services/api';

interface UsernamePromptProps {
    onComplete: () => void;
}

export function UsernamePrompt({ onComplete }: UsernamePromptProps) {
    const [username, setUsername] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);

    const validateUsername = (value: string): boolean => {
        if (value.length < 3) {
            setError('Username must be at least 3 characters');
            return false;
        }
        if (value.length > 16) {
            setError('Username must be 16 characters or less');
            return false;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            setError('Use only letters, numbers, and underscores');
            return false;
        }
        setError(null);
        return true;
    };

    const checkAvailability = async (value: string) => {
        if (!validateUsername(value)) return;

        setChecking(true);
        try {
            const res = await fetch(`${API_URL}/auth/check-username?username=${value}`);
            const data = await res.json();
            if (!data.available) {
                setError('Username already taken');
            }
        } finally {
            setChecking(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateUsername(username) || error) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/set-username`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({ username })
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Unable to save username. Please try again.');
                return;
            }

            onComplete();
        } finally {
            setLoading(false);
        }
    };

    const isAvailable = !error && username.length >= 3 && !checking;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-surface rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
                <h2 className="text-xl font-bold text-text mb-2">Create your username</h2>
                <p className="text-sm text-text-secondary mb-4">
                    Others can find you by your username.<br />
                    Username and visibility can be modified in settings later.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Input
                            type="text"
                            value={username}
                            onChange={(e) => {
                                const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                                setUsername(value);
                                setError(null);
                                if (value.length >= 3) {
                                    setTimeout(() => checkAvailability(value), 800);
                                }
                            }}
                            placeholder="your_username"
                            maxLength={16}
                            error={error || undefined}
                            helperText={isAvailable ? 'Available' : undefined}
                            autoFocus
                        />
                    </div>

                    <Button
                        type="submit"
                        isLoading={loading}
                        disabled={!!error || username.length < 3 || checking}
                        className="w-full"
                    >
                        Continue
                    </Button>
                </form>
            </div>
        </div>
    );
}