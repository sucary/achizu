import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface UserMenuProps {
    onOpenAdminDashboard?: () => void;
}

export function UserMenu({ onOpenAdminDashboard }: UserMenuProps) {
    const { user, profile, signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user || !profile) return null;

    const handleSignOut = async () => {
        await signOut();
        setIsOpen(false);
    };

    const displayName = profile.username || user.email?.split('@')[0] || 'User';

    return (
        <div ref={menuRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-2 px-4 py-2 bg-surface shadow-md hover:shadow-lg transition-shadow w-56 ${isOpen ? 'rounded-t-lg' : 'rounded-lg'}`}
            >
                <div className="flex flex-col items-start min-w-0 flex-1">
                    {profile.username && (
                        <span className="text-sm font-medium text-text  truncate w-left">
                            {profile.username}
                        </span>
                    )}
                    <span className="text-xs text-text-muted truncate w-left">
                        {user.email}
                    </span>
                </div>
                <svg
                    className={`w-4 h-4 text-text-secondary transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 w-56 bg-surface rounded-b-lg shadow-lg border-t border-border py-1 z-[1001]">
                    {profile.isAdmin && onOpenAdminDashboard && (
                        <button
                            onClick={() => {
                                onOpenAdminDashboard();
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-text hover:bg-surface-muted transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Admin Dashboard
                        </button>
                    )}
                    <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-text hover:bg-surface-muted transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
}
