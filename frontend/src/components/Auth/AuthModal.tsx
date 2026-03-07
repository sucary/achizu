import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Input, Button, Spinner, Alert, IconButton } from '../ui';
import { CloseIcon, EyeIcon, EyeOffIcon, GoogleIcon, GitHubIcon, CheckIcon } from '../icons/FormIcons';

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

    const clearMessages = () => { setError(null); setMessage(null); };

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
            if (!data.available) setUsernameError('Username already taken');
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
            if (!data.available) setEmailError('Email already registered');
        } catch (error) {
            console.error('Failed to check email:', error);
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();
        setLoading(true);

        try {
            if (isSignUp) {
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
                    setError(error.message === 'Invalid login credentials'
                        ? 'Incorrect email or password. Please try again.'
                        : error.message);
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

    const getEmailHelperText = () => {
        if (!isSignUp) return undefined;
        if (checkingEmail) return 'Checking availability...';
        if (!emailError && email && !checkingEmail && email.includes('@')) return '✓ Email available!';
        return undefined;
    };

    const getUsernameHelperText = () => {
        if (checkingUsername) return 'Checking availability...';
        if (!usernameError && username && !checkingUsername && username.length >= 3) return '✓ Username available!';
        return undefined;
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            <div className="relative bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                <IconButton onClick={onClose} className="absolute top-4 right-4">
                    <CloseIcon className="w-6 h-6" />
                </IconButton>

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
                                onChange={(e) => { setForgotPasswordEmail(e.target.value); setError(null); }}
                                required
                                autoFocus
                            />
                            {error && <Alert variant="error">{error}</Alert>}
                            {message && <Alert variant="success">{message}</Alert>}
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
                            {oauthLoading === 'google' ? <Spinner size="sm" /> : <GoogleIcon />}
                            <span className="ml-2">Google</span>
                        </Button>
                        <Button onClick={() => handleOAuthClick('github')} disabled={oauthLoading !== null} variant="secondary" className="flex-1">
                            {oauthLoading === 'github' ? <Spinner size="sm" /> : <GitHubIcon />}
                            <span className="ml-2">GitHub</span>
                        </Button>
                    </div>

                    <div className="flex items-center gap-3 mb-6 text-sm text-text-secondary">
                        <div className="flex-1 border-t border-border-strong" />
                        <span>or</span>
                        <div className="flex-1 border-t border-border-strong" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            type="email"
                            label="Email"
                            value={email}
                            onChange={(e) => {
                                const value = e.target.value;
                                setEmail(value);
                                setEmailError(null);
                                if (isSignUp && value.includes('@')) setTimeout(() => checkEmailAvailability(value), 500);
                            }}
                            error={isSignUp ? emailError || undefined : undefined}
                            helperText={getEmailHelperText()}
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
                                helperText={getUsernameHelperText()}
                                required
                            />
                        )}

                        <Input
                            type={showPassword ? 'text' : 'password'}
                            label="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                                    <span className="ml-2 text-sm text-text">Remember me</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => { setIsForgotPassword(true); setForgotPasswordEmail(email); clearMessages(); }}
                                    className="text-sm text-text hover:underline"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        )}

                        {error && <Alert variant="error">{error}</Alert>}
                        {message && <Alert variant="success">{message}</Alert>}

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
            </div>
        </div>
    );
}
