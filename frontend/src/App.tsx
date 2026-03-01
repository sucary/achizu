import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import './App.css';
import { deleteArtist } from './services/api';
import MapView from './components/Map/MapView';
import ArtistForm from './components/ArtistForm';
import ArtistList from './components/ArtistList';
import AddArtistButton from './components/Map/buttons/AddArtistButton';
import ViewArtistListButton from './components/Map/buttons/ViewArtistListButton';
import { AccountButton } from './components/Auth/AccountButton';
import { NotificationButton } from './components/Notifications/NotificationButton';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { BackendStatus } from './components/BackendStatus';
import { useAuth } from './context/AuthContext';
import type { Artist, SelectionMode } from './types/artist';
import { UsernamePrompt } from './components/Auth/UsernamePrompt';
import { ResetPasswordModal } from './components/Auth/ResetPasswordModal';
import { supabase } from './lib/supabase';


function App() {
    const { username } = useParams<{ username?: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user, profile, loading } = useAuth();

    // Viewing another user's map (admin only)
    const isViewingOther = !!username;
    const isOwnUsername = username && profile?.username === username;

    // Redirect non-admin users away from other users' maps
    useEffect(() => {
        if (loading) return;
        if (isViewingOther && !isOwnUsername && !profile?.isAdmin) {
            navigate('/', { replace: true });
        }
    }, [username, profile, loading, isViewingOther, isOwnUsername, navigate]);

    // Listen for password recovery event
    useEffect(() => {
        // Check URL hash on mount (in case event fired before listener attached)
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
            setShowResetPassword(true);
            // Clean up URL
            window.history.replaceState(null, '', window.location.pathname);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setShowResetPassword(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    
    const [showForm, setShowForm] = useState(false);
    const [showArtistList, setShowArtistList] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showAdminDashboard, setShowAdminDashboard] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
    const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);
    const [pendingCoordinates, setPendingCoordinates] = useState<{ lat: number; lng: number } | null>(null);

    const handleStartSelection = (targetField: 'originalLocation' | 'activeLocation') => {
        setSelectionMode({ active: true, targetField });
    };

    const handleLocationPick = (coordinates: { lat: number; lng: number } | null) => {
        setPendingCoordinates(coordinates);
        setSelectionMode(null);
    };

    const handleConsumeCoordinates = () => {
        setPendingCoordinates(null);
    };

    const handleEditArtist = (artist: Artist) => {
        if (!user) {
            setShowAuthModal(true);
            return;
        }
        setEditingArtist(artist);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingArtist(null);
        setSelectionMode(null);
    };

    const handleDeleteArtist = async (artist: Artist) => {
        if (!user) {
            setShowAuthModal(true);
            return;
        }

        if (!window.confirm(`Delete "${artist.name}"?`)) {
            return;
        }

        try {
            await deleteArtist(artist.id);
            await queryClient.invalidateQueries({ queryKey: ['artists'] });
        } catch (error) {
            console.error('Failed to delete artist:', error);
            alert('Failed to delete artist. Please try again.');
        }
    };

    const handleAddArtistClick = () => {
        if (!user) {
            setShowAuthModal(true);
        } else {
            setShowArtistList(false);
            setShowForm(true);
        }
    };

    const handleViewArtistListClick = () => {
        setShowForm(false);
        setShowArtistList(true);
    };

    const handleEditFromList = (artist: Artist) => {
        setShowArtistList(false);
        handleEditArtist(artist);
    };

    return (
        <div className="h-screen w-screen flex flex-col">
            <BackendStatus />

            {/* Top right controls */}
            <div className="absolute top-2 right-2 z-[1100] flex items-center gap-2">
                {user && <NotificationButton />}
                <AccountButton
                    showAuthModal={showAuthModal}
                    onOpenAuthModal={() => setShowAuthModal(true)}
                    onCloseAuthModal={() => setShowAuthModal(false)}
                    onOpenAdminDashboard={() => setShowAdminDashboard(true)}
                />
            </div>

            {/* Show username prompt for OAuth users without username */}
            {user && profile && !profile.username && (
                <UsernamePrompt onComplete={() => {
                    queryClient.invalidateQueries({ queryKey: ['profile'] });
                }} />
            )}

            {!showForm && !showArtistList && user && profile?.isApproved && !isViewingOther && (
                <>
                    <AddArtistButton onClick={handleAddArtistClick} />
                    <ViewArtistListButton onClick={handleViewArtistListClick} />
                </>
            )}
            {showForm && (
                <ArtistForm
                    key={editingArtist?.id ?? 'new'}
                    initialData={editingArtist ?? undefined}
                    onCancel={handleCloseForm}
                    onRequestSelection={handleStartSelection}
                    pendingCoordinates={pendingCoordinates}
                    onConsumePendingCoordinates={handleConsumeCoordinates}
                />
            )}
            {showArtistList && (
                <ArtistList
                    onClose={() => setShowArtistList(false)}
                    onEditArtist={handleEditFromList}
                    onDeleteArtist={handleDeleteArtist}
                />
            )}
            {showAdminDashboard && (
                <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
            )}
            {showResetPassword && (
                <ResetPasswordModal onClose={() => setShowResetPassword(false)} />
            )}
            <MapView
                username={username}
                selectionMode={selectionMode}
                onLocationPick={handleLocationPick}
                onEditArtist={isViewingOther ? undefined : handleEditArtist}
                onDeleteArtist={isViewingOther ? undefined : handleDeleteArtist}
                onEmptyClick={showForm ? handleCloseForm : showArtistList ? () => setShowArtistList(false) : undefined}
            />
        </div>
    );
};

export default App;
