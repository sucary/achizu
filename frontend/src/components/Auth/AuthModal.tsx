import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Input, Button, Spinner, Alert, IconButton, CloseButton } from '../ui';
import { EyeIcon, EyeOffIcon, GoogleIcon, GitHubIcon, CheckIcon } from '../icons/FormIcons';
import { API_URL } from '../../services/api';

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
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [forgotPasswordEmailError, setForgotPasswordEmailError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
    const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);

    const { signIn, signUp, signInWithOAuth } = useAuth();

    const clearMessages = () => {
        setError(null);
        setMessage(null);
        setPasswordError(null);
        setForgotPasswordEmailError(null);
    };

    const handleClose = () => {
        clearMessages();
        onClose();
    };

    if (!isOpen) return null;

    const validateEmail = (value: string): boolean => {
        if (!value) {
            setEmailError('Email is required');
            return false;
        }
        if (!value.includes('@') || !value.includes('.')) {
            setEmailError('Please enter a valid email');
            return false;
        }
        return true;
    };

    const validatePassword = (value: string): boolean => {
        if (!value) {
            setPasswordError('Password is required');
            return false;
        }
        if (value.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return false;
        }
        return true;
    };

    const validateUsername = (value: string): boolean => {
        if (value.length < 3) {
            setUsernameError('Username must be at least 3 characters');
            return false;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            setUsernameError('Username can only contain letters, numbers, and underscores');
            return false;
        }
        return true;
    };

    const checkUsernameAvailability = async (username: string) => {
        if (!validateUsername(username)) return;
        try {
            const response = await fetch(
                `${API_URL}/auth/check-username?username=${encodeURIComponent(username)}`
            );
            const data = await response.json();
            if (!data.available) setUsernameError('Username already taken');
        } catch (error) {
            console.error('Failed to check username:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();
        setEmailError(null);
        setPasswordError(null);
        setUsernameError(null);

        // Validate all fields simultaneously
        const isEmailValid = validateEmail(email);
        const isPasswordValid = validatePassword(password);
        const isUsernameValid = isSignUp ? validateUsername(username) : true;

        if (!isEmailValid || !isPasswordValid || !isUsernameValid) {
            return;
        }

        setLoading(true);

        try {
            if (isSignUp) {
                // Check email availability first
                try {
                    const emailCheckRes = await fetch(
                        `${API_URL}/auth/check-email?email=${encodeURIComponent(email)}`
                    );
                    const emailCheckData = await emailCheckRes.json();
                    if (!emailCheckData.available) {
                        setEmailError('Email already registered');
                        setLoading(false);
                        return;
                    }
                } catch {
                    // If check fails, proceed with signup (Supabase will handle it)
                }

                const { error } = await signUp(email, password, username);
                if (error) {
                    if (error.message.toLowerCase().includes('email')) {
                        setEmailError(error.message);
                    } else if (error.message.toLowerCase().includes('password')) {
                        setPasswordError(error.message);
                    } else {
                        setError(error.message);
                    }
                } else {
                    setMessage('Check your email for confirmation.');
                }
            } else {
                const { error } = await signIn(email, password, rememberMe);
                if (error) {
                    setError(error.message === 'Invalid login credentials'
                        ? 'Incorrect email or password'
                        : error.message);
                } else {
                    handleClose();
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
            setForgotPasswordEmailError('Please enter your email');
            return;
        }
        if (!forgotPasswordEmail.includes('@')) {
            setForgotPasswordEmailError('Please enter a valid email');
            return;
        }
        setLoading(true);
        setForgotPasswordEmailError(null);
        const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
            redirectTo: `${window.location.origin}/`,
        });
        setLoading(false);
        if (error) {
            setForgotPasswordEmailError(error.message);
        } else {
            setMessage('Check your email for the password reset link');
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

            <div className="relative bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                {!message && (
                    <CloseButton onClick={handleClose} size="lg" className="absolute top-4 right-4" />
                )}

                {message ? (
                    <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-text-muted/10 flex items-center justify-center">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-text-muted" />
                                <div className="w-2 h-2 rounded-full bg-text-muted" />
                                <div className="w-2 h-2 rounded-full bg-text-muted" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-text mb-2">Check your email</h2>
                        <p className="text-sm text-text-secondary mb-6">We've sent a confirmation link to <span className="font-medium text-text">{email || forgotPasswordEmail}</span></p>
                        <div className="flex gap-3">
                            <Button onClick={handleClose} variant="secondary" className="flex-1">Resend</Button>
                            <Button onClick={handleClose} className="flex-1">Done</Button>
                        </div>
                    </div>
                ) : (
                <>
                <h2 className="text-2xl font-bold text-text mb-6">
                    {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
                </h2>

                {isForgotPassword ? (
                    <>
                        <p className="text-sm text-text-secondary mb-6">
                            Enter your email and we'll send you a link to reset your password.
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }} className="space-y-4">
                            <Input
                                type="email"
                                label="Email"
                                value={forgotPasswordEmail}
                                onChange={(e) => { setForgotPasswordEmail(e.target.value); setForgotPasswordEmailError(null); }}
                                error={forgotPasswordEmailError || undefined}
                                required
                                autoFocus
                            />
                            <Button type="submit" isLoading={loading} className="w-full">Send reset link</Button>
                            <p className="text-center text-sm text-text-secondary">
                                <button
                                    type="button"
                                    onClick={() => { setIsForgotPassword(false); clearMessages(); }}
                                    className="text-primary hover:underline font-medium"
                                >
                                    Back to Sign In
                                </button>
                            </p>
                        </form>
                    </>
                ) : (
                <>
                    {/* OAuth buttons */}
                    <div className="flex gap-3 mb-6">
                        <Button onClick={() => handleOAuthClick('google')} disabled={oauthLoading !== null} variant="secondary" className="flex-1">
                            <span className="flex items-center justify-center w-full gap-2">
                                {oauthLoading === 'google' ? <Spinner size="sm" /> : <GoogleIcon />}
                                Google
                            </span>
                        </Button>
                        <Button onClick={() => handleOAuthClick('github')} disabled={oauthLoading !== null} variant="secondary" className="flex-1">
                            <span className="flex items-center justify-center w-full gap-2">
                                {oauthLoading === 'github' ? <Spinner size="sm" /> : <GitHubIcon />}
                                GitHub
                            </span>
                        </Button>
                    </div>

                    <div className="flex items-center gap-3 mb-6 text-sm text-text-secondary">
                        <div className="flex-1 border-t border-border-strong" />
                        <span>or</span>
                        <div className="flex-1 border-t border-border-strong" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <Input
                            type="email"
                            label="Email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setEmailError(null);
                            }}
                            error={emailError || undefined}
                            required
                        />

                        {isSignUp && (
                            <Input
                                type="text"
                                label="Username"
                                value={username}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setUsername(value);
                                    if (value.length >= 3) setTimeout(() => checkUsernameAvailability(value), 500);
                                }}
                                placeholder="username"
                                error={usernameError || undefined}
                                required
                            />
                        )}

                        <Input
                            type={showPassword ? 'text' : 'password'}
                            label="Password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                            error={passwordError || undefined}
                            required
                            minLength={6}
                            rightIcon={
                                <IconButton type="button" size="sm" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </IconButton>
                            }
                        />

                        {!isSignUp && (
                            <div className="flex items-center justify-between">
                                <label className="flex items-center cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-4 h-4 border border-border-strong rounded peer-checked:bg-primary peer-checked:border-primary group-hover:border-primary flex items-center justify-center">
                                        {rememberMe && <CheckIcon className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className="ml-2 text-sm text-text-secondary">Remember me</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => { setIsForgotPassword(true); setForgotPasswordEmail(email); clearMessages(); }}
                                    className="text-sm text-text-secondary hover:underline"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        )}

                        {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

                        <Button type="submit" isLoading={loading} className="w-full">
                            {isSignUp ? 'Sign Up' : 'Sign In'}
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-sm text-text-secondary">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            onClick={() => { setIsSignUp(!isSignUp); clearMessages(); }}
                            className="text-primary hover:underline font-medium"
                        >
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </p>
                </>
                )}
                </>
                )}
            </div>
        </div>
    );
}
