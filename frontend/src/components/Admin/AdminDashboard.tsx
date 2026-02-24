import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { PendingUser } from '../../types/profile';

interface AdminDashboardProps {
    onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
    const { user, profile } = useAuth();
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPendingUsers();
    }, []);

    const fetchPendingUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const { supabase } = await import('../../lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch('http://localhost:3000/api/auth/admin/pending-users', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch pending users');
            }

            const data = await response.json();
            setPendingUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load pending users');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (userId: string) => {
        try {
            const { supabase } = await import('../../lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`http://localhost:3000/api/auth/admin/approve/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to approve user');
            }

            // Remove from list
            setPendingUsers(prev => prev.filter(u => u.id !== userId));
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to approve user');
        }
    };

    const handleReject = async (userId: string) => {
        if (!confirm('Are you sure you want to reject and remove this user?')) {
            return;
        }

        try {
            const { supabase } = await import('../../lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`http://localhost:3000/api/auth/admin/reject/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to reject user');
            }

            // Remove from list
            setPendingUsers(prev => prev.filter(u => u.id !== userId));
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reject user');
        }
    };

    // Check if user is admin
    if (!user || !profile || !profile.isAdmin) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Dashboard Window */}
            <div className="relative bg-surface rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h1 className="text-2xl font-bold text-text">Admin Dashboard</h1>
                    <button
                        onClick={onClose}
                        className="text-text-muted hover:text-text-secondary transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-text mb-4">
                            Pending User Approvals ({pendingUsers.length})
                        </h2>

                        {loading && (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                <p className="text-text-secondary mt-2">Loading...</p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-error/10 border border-error/30 rounded-lg p-4 mb-4">
                                <p className="text-error">{error}</p>
                            </div>
                        )}

                        {!loading && !error && pendingUsers.length === 0 && (
                            <div className="text-center py-8 text-text-secondary">
                                <svg className="w-12 h-12 mx-auto mb-2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>No pending approvals</p>
                            </div>
                        )}

                        {!loading && !error && pendingUsers.length > 0 && (
                            <div className="space-y-3">
                                {pendingUsers.map(user => (
                                    <div key={user.id} className="border border-border rounded-lg p-4 flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-text">{user.username || 'No username'}</p>
                                            <p className="text-sm text-text-secondary">{user.email}</p>
                                            <p className="text-xs text-text-muted mt-1">
                                                Registered: {new Date(user.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(user.id)}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(user.id)}
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
