import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
    const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);

    const { signIn, signUp, signInWithOAuth } = useAuth();

    if (!isOpen) return null;

    const validateUsername = (value: string): boolean => {
        if (value.length < 3) {
            setUsernameError('Username must be at least 3 characters');
            return false;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            setUsernameError('Username can only contain letters, numbers, and underscores');
            return false;
        }
        setUsernameError(null);
        return true;
    };

    const checkUsernameAvailability = async (username: string) => {
        if (!validateUsername(username)) return;

        setCheckingUsername(true);
        try {
            const response = await fetch(
                `http://localhost:3000/api/auth/check-username?username=${encodeURIComponent(username)}`
            );
            const data = await response.json();
            if (!data.available) {
                setUsernameError('Username already taken');
            }
        } catch (error) {
            console.error('Failed to check username:', error);
        } finally {
            setCheckingUsername(false);
        }
    };

    const checkEmailAvailability = async (email: string) => {
        if (!email || !email.includes('@')) {
            setEmailError('Please enter a valid email');
            return;
        }

        setCheckingEmail(true);
        setEmailError(null);
        try {
            const response = await fetch(
                `http://localhost:3000/api/auth/check-email?email=${encodeURIComponent(email)}`
            );
            const data = await response.json();
            if (!data.available) {
                setEmailError('Email already registered');
            }
        } catch (error) {
            console.error('Failed to check email:', error);
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            if (isSignUp) {
                // Validate email and username
                if (emailError || usernameError) {
                    setError('Please resolve the errors above');
                    setLoading(false);
                    return;
                }

                if (!username || !validateUsername(username)) {
                    setError('Please enter a valid username');
                    setLoading(false);
                    return;
                }

                const { error } = await signUp(email, password, username);
                if (error) {
                    setError(error.message);
                } else {
                    setMessage('Registration successful! Check your email for confirmation.');
                }
            } else {
                const { error } = await signIn(email, password, rememberMe);
                if (error) {
                    // Map Supabase error messages to user-friendly messages
                    if (error.message === 'Invalid login credentials') {
                        setError('Incorrect email or password. Please try again.');
                    } else {
                        setError(error.message);
                    }
                } else {
                    onClose();
                }
            }
        } catch {
            setError('An unexpected error happened. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthClick = async (provider: 'google' | 'github') => {
        setError(null);
        setOauthLoading(provider);
        try {
            await signInWithOAuth(provider);
        } catch {
            setError('Unable to sign in with ' + provider + '. Please try again.');
        } finally {
            setOauthLoading(null);
        }
    };

    const handleForgotPassword = async () => {
        if (!forgotPasswordEmail) {
            setError('Please enter your email');
            return;
        }
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
            redirectTo: `${window.location.origin}/`,
        });
        setLoading(false);
        if (error) {
            setError(error.message);
        } else {
            setMessage('Check your email for the password reset link');
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-text-muted hover:text-text-secondary"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <h2 className="text-2xl font-bold text-text mb-6">
                    {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
                </h2>

                {/* Forgot Password View */}
                {isForgotPassword ? (
                    <div>
                        <p className="text-sm text-text-secondary mb-6">
                            Enter your email and we'll send you a link to reset your password.
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={forgotPasswordEmail}
                                    onChange={(e) => {
                                        setForgotPasswordEmail(e.target.value);
                                        setError(null);
                                    }}
                                    className="w-full px-3 py-2 bg-surface border border-border-strong rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                                    required
                                    autoFocus
                                />
                            </div>

                            {error && <p className="text-error text-sm">{error}</p>}
                            {message && <p className="text-green-600 text-sm">{message}</p>}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Sending...' : 'Send reset link'}
                            </button>

                            <p className="text-center text-sm text-text-secondary">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsForgotPassword(false);
                                        setError(null);
                                        setMessage(null);
                                    }}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Back to Sign In
                                </button>
                            </p>
                        </form>
                    </div>
                ) : (
                <>
                {/* OAuth buttons */}
                <div className="flex gap-3 mb-6">
                    <button
                        onClick={() => handleOAuthClick('google')}
                        disabled={oauthLoading !== null}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border-strong rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {oauthLoading === 'google' ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        )}
                        <span className="text-sm">Google</span>
                    </button>

                    <button
                        onClick={() => handleOAuthClick('github')}
                        disabled={oauthLoading !== null}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border-strong rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {oauthLoading === 'github' ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                        )}
                        <span className="text-sm">GitHub</span>
                    </button>
                </div>

                {/* Divider */}
                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border-strong"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-surface text-text-secondary">or</span>
                    </div>
                </div>

                {/* Email form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                const value = e.target.value;
                                setEmail(value);
                                setEmailError(null);
                                if (isSignUp && value.includes('@')) {
                                    setTimeout(() => checkEmailAvailability(value), 500);
                                }
                            }}
                            className="w-full px-3 py-2 bg-surface border border-border-strong rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                            required
                        />
                        {isSignUp && checkingEmail && (
                            <p className="text-xs text-text-secondary mt-1">Checking availability...</p>
                        )}
                        {isSignUp && emailError && (
                            <p className="text-xs text-error mt-1">{emailError}</p>
                        )}
                        {isSignUp && !emailError && email && !checkingEmail && email.includes('@') && (
                            <p className="text-xs text-green-600 mt-1">✓ Email available!</p>
                        )}
                    </div>

                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-text mb-1">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setUsername(value);
                                    if (value.length >= 3) {
                                        setTimeout(() => checkUsernameAvailability(value), 500);
                                    }
                                }}
                                className="w-full px-3 py-2 bg-surface border border-border-strong rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                                placeholder="username"
                                required
                            />
                            {checkingUsername && (
                                <p className="text-xs text-text-secondary mt-1">Checking availability...</p>
                            )}
                            {usernameError && (
                                <p className="text-xs text-error mt-1">{usernameError}</p>
                            )}
                            {!usernameError && username && !checkingUsername && username.length >= 3 && (
                                <p className="text-xs text-green-600 mt-1">✓ Username available!</p>
                            )}
                        </div>
                    )}

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-text">
                                Password
                            </label>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 pr-10 bg-surface border border-border-strong rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {!isSignUp && (
                        <div className="flex items-center justify-between">
                            <label className="flex items-center cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-4 h-4 border border-border-strong rounded peer-checked:bg-primary peer-checked:border-primary group-hover:border-primary group-hover:ring-1 group-hover:ring-primary flex items-center justify-center">
                                    <svg className={`w-3 h-3 text-white ${rememberMe ? 'block' : 'hidden'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span className="ml-2 text-sm text-text">
                                    Remember me
                                </span>
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsForgotPassword(true);
                                    setForgotPasswordEmail(email);
                                    setError(null);
                                    setMessage(null);
                                }}
                                className="text-sm text-text hover:underline"
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}

                    {error && (
                        <p className="text-error text-sm">{error}</p>
                    )}

                    {message && (
                        <p className="text-green-600 text-sm">{message}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                {/* Toggle sign up / sign in */}
                <p className="mt-4 text-center text-sm text-text-secondary">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            setMessage(null);
                        }}
                        className="text-primary hover:underline font-medium"
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
                </>
                )}
            </div>
        </div>
    );
}
