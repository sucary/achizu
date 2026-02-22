import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import './App.css';
import { deleteArtist, type SearchResult } from './services/api';
import MapView from './components/Map/MapView';
import ArtistForm from './components/ArtistForm';
import AddArtistButton from './components/Map/buttons/AddArtistButton';
import { AccountButton } from './components/Auth/AccountButton';
import { NotificationButton } from './components/Notifications/NotificationButton';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { BackendStatus } from './components/BackendStatus';
import { useAuth } from './context/AuthContext';
import type { Artist, SelectionMode } from './types/artist';
import { UsernamePrompt } from './components/Auth/UsernamePrompt';


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

    
    const [showForm, setShowForm] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showAdminDashboard, setShowAdminDashboard] = useState(false);
    const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
    const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);
    const [pendingLocationResult, setPendingLocationResult] = useState<SearchResult | null | undefined>(undefined);

    const handleStartSelection = (targetField: 'originalLocation' | 'activeLocation') => {
        setSelectionMode({ active: true, targetField });
    };

    const handleLocationPick = (result: SearchResult | null) => {
        setPendingLocationResult(result);
        setSelectionMode(null);
    };

    const handleConsumeResult = () => {
        setPendingLocationResult(undefined);
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
            setShowForm(true);
        }
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

            {!showForm && user && profile?.isApproved && !isViewingOther && (
                <AddArtistButton onClick={handleAddArtistClick} />
            )}
            {showForm && (
                <ArtistForm
                    key={editingArtist?.id ?? 'new'}
                    initialData={editingArtist ?? undefined}
                    onCancel={handleCloseForm}
                    onRequestSelection={handleStartSelection}
                    pendingLocationResult={pendingLocationResult}
                    onConsumePendingResult={handleConsumeResult}
                />
            )}
            {showAdminDashboard && (
                <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
            )}
            <MapView
                username={username}
                selectionMode={selectionMode}
                onLocationPick={handleLocationPick}
                onEditArtist={isViewingOther ? undefined : handleEditArtist}
                onDeleteArtist={isViewingOther ? undefined : handleDeleteArtist}
                onEmptyClick={showForm ? handleCloseForm : undefined}
            />
        </div>
    );
};

export default App;
