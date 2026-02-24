import { useState } from 'react';
import { supabase } from '../../lib/supabase';

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
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            setError('Only letters, numbers, and underscores allowed');
            return false;
        }
        setError(null);
        return true;
    };

    const checkAvailability = async (value: string) => {
        if (!validateUsername(value)) return;

        setChecking(true);
        try {
            const res = await fetch(`http://localhost:3000/api/auth/check-username?username=${value}`);
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
            const res = await fetch('http://localhost:3000/api/auth/set-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({ username })
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Failed to set username');
                return;
            }

            onComplete();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                <h2 className="text-2xl font-bold text-text mb-4">Enter your username</h2>
                <p className="text-text-secondary mb-6">This will be used for identifying you and searching for other users.</p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            if (e.target.value.length >= 3) {
                                setTimeout(() => checkAvailability(e.target.value), 500);
                            }
                        }}
                        placeholder="username"
                        className="w-full px-3 py-2 border border-border-strong rounded-lg mb-2"
                        autoFocus
                    />

                    {checking && <p className="text-xs text-text-secondary mb-2">Checking availability...</p>}
                    {error && <p className="text-xs text-error mb-2">{error}</p>}
                    {!error && username.length >= 3 && !checking && (
                        <p className="text-xs text-green-600 mb-2">✓ Username available!</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !!error || username.length < 3}
                        className="w-full py-2.5 bg-primary text-white rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Setting...' : 'Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}