import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../services/api';

export function SettingsPage() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    // Username state
    const [username, setUsername] = useState(profile?.username || '');
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [usernameSaving, setUsernameSaving] = useState(false);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // Privacy state
    const [isPrivate, setIsPrivate] = useState(profile?.isPrivate ?? false);
    const [privacySaving, setPrivacySaving] = useState(false);
    const [privacyError, setPrivacyError] = useState<string | null>(null);

    // Sync isPrivate with profile when it changes
    useEffect(() => {
        if (profile) {
            setIsPrivate(profile.isPrivate ?? false);
        }
    }, [profile]);

    if (!user || !profile) return null;

    const handleUsernameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (username === profile.username) return;

        setUsernameSaving(true);
        setUsernameError(null);

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ username }),
            });

            if (!res.ok) {
                const data = await res.json();
                setUsernameError(data.error || 'Failed to update username');
                return;
            }

            // Refresh profile in context
            window.location.reload();
        } catch {
            setUsernameError('Unable to update username. Please try again.');
        } finally {
            setUsernameSaving(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError(null);

        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }

        setPasswordSaving(true);

        try {
            // Verify current password by signing in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: profile.email,
                password: currentPassword,
            });

            if (signInError) {
                setPasswordError('Current password is incorrect');
                setPasswordSaving(false);
                return;
            }

            // Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                setPasswordError(updateError.message);
                return;
            }

            setPasswordSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            setPasswordError('Unable to update password. Please try again.');
        } finally {
            setPasswordSaving(false);
        }
    };

    const handlePrivacyToggle = async () => {
        const newValue = !isPrivate;
        setPrivacySaving(true);
        setPrivacyError(null);

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ isPrivate: newValue }),
            });

            if (!res.ok) {
                const data = await res.json();
                setPrivacyError(data.error || 'Failed to update privacy setting');
                return;
            }

            setIsPrivate(newValue);
        } catch {
            setPrivacyError('Unable to update privacy setting. Please try again.');
        } finally {
            setPrivacySaving(false);
        }
    };

    const inputClass = 'w-full px-3 py-2 border border-border-strong rounded-md text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary';

    return (
        <div className="min-h-screen bg-background">
            {/* Content */}
            <div className="max-w-lg mx-auto px-4 py-4">
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>Back to map</span>
                    </button>
                    <span className="text-border-strong">|</span>
                    <h1 className="text-lg font-bold text-text">Settings</h1>
                </div>
                <div className="bg-surface rounded-lg border border-border divide-y divide-border">

                    {/* Privacy */}
                    <div className="p-5">
                        <h2 className="text-lg text-text mb-3">Privacy</h2>
                        <div className="flex items-center justify-between gap-5">
                            <div>
                                <p className="text-sm text-text-secondary">
                                    Hide your account from other users.
                                </p>
                                {privacyError && <p className="text-xs text-error mt-1">{privacyError}</p>}
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isPrivate}
                                onClick={handlePrivacyToggle}
                                disabled={privacySaving}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${isPrivate ? 'bg-primary' : 'bg-border-strong'}`}
                            >
                                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${isPrivate ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Username */}
                    <div className="p-5">
                        <h2 className="text-lg text-text mb-3">Username</h2>
                        <form onSubmit={handleUsernameSubmit} className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Change username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        setUsernameError(null);
                                    }}
                                    className={inputClass}
                                />
                                {usernameError && <p className="text-xs text-error mt-1">{usernameError}</p>}
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={usernameSaving || username === profile.username || username.length < 3}
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {usernameSaving ? 'Saving...' : 'Save username'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Password */}
                    <div className="p-5">
                        <h2 className="text-lg text-text mb-3">Change Password</h2>
                        <form onSubmit={handlePasswordSubmit} className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Current password</label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }}
                                        className={`${inputClass} pr-10`}
                                    />
                                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                                        <EyeIcon open={showCurrentPassword} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">New password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }}
                                        className={`${inputClass} pr-10`}
                                        minLength={6}
                                    />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                                        <EyeIcon open={showNewPassword} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Confirm new password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }}
                                    className={inputClass}
                                    minLength={6}
                                />
                            </div>
                            {passwordError && <p className="text-xs text-error">{passwordError}</p>}
                            {passwordSuccess && <p className="text-xs text-green-600">Password updated successfully</p>}
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {passwordSaving ? 'Updating...' : 'Change password'}
                                </button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
}

function EyeIcon({ open }: { open: boolean }) {
    if (open) {
        return (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
        );
    }
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    );
}
