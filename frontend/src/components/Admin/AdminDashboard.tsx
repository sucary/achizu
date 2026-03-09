import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Spinner, Alert, Button, CloseButton } from '../ui';
import { CheckCircleIcon } from '../icons/GeneralIcons';
import { API_URL } from '../../services/api';
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

            const response = await fetch(`${API_URL}/auth/admin/pending-users`, {
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

            const response = await fetch(`${API_URL}/auth/admin/approve/${userId}`, {
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

            const response = await fetch(`${API_URL}/auth/admin/reject/${userId}`, {
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
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h1 className="text-lg font-bold text-text">Admin Dashboard</h1>
                    <CloseButton onClick={onClose} size="md" />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    <div className="mb-6">
                        <h2 className="text-lg text-text mb-3">
                            Pending User Approvals ({pendingUsers.length})
                        </h2>

                        {loading && (
                            <div className="text-center py-8">
                                <Spinner size="lg" className="mx-auto text-primary" />
                                <p className="text-text-secondary mt-2">Loading...</p>
                            </div>
                        )}

                        {error && (
                            <Alert variant="error" className="mb-4">{error}</Alert>
                        )}

                        {!loading && !error && pendingUsers.length === 0 && (
                            <div className="text-center py-8 text-text-secondary">
                                <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-text-muted" />
                                <p>No pending approvals</p>
                            </div>
                        )}

                        {!loading && !error && pendingUsers.length > 0 && (
                            <div className="space-y-3">
                                {pendingUsers.map(user => (
                                    <div key={user.id} className="border border-border rounded-lg p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-text">{user.username || 'No username'}</p>
                                            <p className="text-sm text-text-secondary">{user.email}</p>
                                            <p className="text-xs text-text-muted mt-1">
                                                Registered: {new Date(user.createdAt).toLocaleDateString('fi-FI')} {new Date(user.createdAt).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleApprove(user.id)}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                onClick={() => handleReject(user.id)}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                Reject
                                            </Button>
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
