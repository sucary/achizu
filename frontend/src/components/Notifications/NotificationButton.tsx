import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

interface PendingUser {
    id: string;
    email: string;
    username: string | null;
    createdAt: string;
}

export function NotificationButton() {
    const { profile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // Fetch pending users for admin
    const { data: pendingUsers } = useQuery({
        queryKey: ['pendingUsers'],
        queryFn: async () => {
            const response = await api.get<PendingUser[]>('/auth/admin/pending-users');
            return response.data;
        },
        enabled: !!profile?.isAdmin,
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    // Build notifications
    const notifications: { type: string; message: string; detail?: string; action?: string }[] = [];

    if (profile && !profile.isApproved) {
        notifications.push({
            type: 'warning',
            message: 'Account Pending Approval',
            detail: 'Your account is awaiting admin approval.'
        });
    }

    if (profile?.isAdmin && pendingUsers && pendingUsers.length > 0) {
        notifications.push({
            type: 'info',
            message: `${pendingUsers.length} Pending Approval${pendingUsers.length > 1 ? 's' : ''}`,
            detail: 'Users waiting for account approval.',
            action: 'admin'
        });
    }

    // Don't render if no notifications
    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                // w h - 13, its 12 + 1 for exceed badge padding
                className="w-13 h-13 flex items-center justify-center bg-surface rounded-lg shadow-md hover:bg-surface-muted transition-colors text-text relative"
            >
                {/* Bell Icon */}
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {/* Badge */}
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {notifications.length}
                </span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[1099]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-surface rounded-lg shadow-lg border border-border z-[1100]">
                        <div className="p-3 border-b border-border flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-text">Notifications</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-text-muted hover:text-text transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.map((notification, index) => (
                                <div
                                    key={index}
                                    className="p-3 border-b border-surface-secondary last:border-b-0 hover:bg-surface-secondary"
                                >
                                    <div className="flex items-start gap-2">
                                        {notification.type === 'warning' && (
                                            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        {notification.type === 'info' && (
                                            <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-text">{notification.message}</p>
                                            {notification.detail && (
                                                <p className="text-xs text-text-secondary mt-0.5">{notification.detail}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
