import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import './App.css';
import { deleteArtist } from './services/api';
import MapView from './components/Map/MapView';
import ArtistForm from './components/ArtistForm/ArtistForm';
import ArtistList from './components/ArtistList';
import AddArtistButton from './components/Map/buttons/AddArtistButton';
import ViewArtistListButton from './components/Map/buttons/ViewArtistListButton';
import { AccountButton } from './components/Auth/AccountButton';
import { NotificationButton } from './components/Notifications/NotificationButton';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { BackendStatus } from './components/BackendStatus';
import { MainSearch } from './components/MainSearch';
import { useAuth } from './context/AuthContext';
import type { Artist, SelectionMode } from './types/artist';
import type { ArtistSearchResult, LocationSearchResult } from './types/search';
import { UsernamePrompt } from './components/Auth/UsernamePrompt';
import { ResetPasswordModal } from './components/Auth/ResetPasswordModal';
import { ViewingUserBanner } from './components/ViewingUserBanner';
import { supabase } from './lib/supabase';


function App() {
    const { username } = useParams<{ username?: string }>();
    const queryClient = useQueryClient();
    const { user, profile } = useAuth();

    const [showForm, setShowForm] = useState(false);
    const [showArtistList, setShowArtistList] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showAdminDashboard, setShowAdminDashboard] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(() => {
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
            window.history.replaceState(null, '', window.location.pathname);
            return true;
        }
        return false;
    });
    const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
    const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);
    const [pendingCoordinates, setPendingCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [focusedArtist, setFocusedArtist] = useState<Artist | null>(null);
    const [focusedLocation, setFocusedLocation] = useState<{ lat: number; lng: number; locationType?: string } | null>(null);
    const [focusedCityId, setFocusedCityId] = useState<string | null>(null);

    // Viewing another user's map
    const isViewingOther = !!username;

    // Listen for password recovery event from auth state changes
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setShowResetPassword(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

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

    const handleNavigateToArtist = (artist: Artist) => {
        setShowArtistList(false);
        setFocusedArtist(artist);
    };

    // Search handlers
    const handleSearchFocusArtist = useCallback((result: ArtistSearchResult) => {
        const artist: Artist = {
            id: result.id,
            name: result.name,
            sourceImage: result.sourceImage,
            avatarCrop: result.avatarCrop,
            activeLocation: {
                city: result.activeLocation.city,
                province: result.activeLocation.province,
                coordinates: result.coordinates,
            },
            originalLocation: {
                city: result.activeLocation.city,
                province: result.activeLocation.province,
                coordinates: result.coordinates,
            },
            originalLocationDisplayCoordinates: result.coordinates,
            activeLocationDisplayCoordinates: result.coordinates,
            originalCityId: '',
            activeCityId: '',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setFocusedArtist(artist);
    }, []);

    const handleSearchFocusLocation = useCallback((result: LocationSearchResult) => {
        setFocusedLocation({ ...result.center, locationType: result.locationType });
        setFocusedCityId(result.id || null);
    }, []);

    return (
        <div className="h-screen w-screen flex flex-col">
            <BackendStatus />

            {/* Top bar */}
            <div className="absolute top-2 left-2 right-2 z-[1100] flex items-center justify-between gap-4">
                {/* Left: Search */}
                <div className="flex items-center">
                    {user && (
                        <MainSearch
                            onFocusArtist={handleSearchFocusArtist}
                            onFocusLocation={handleSearchFocusLocation}
                        />
                    )}
                </div>

                {/* Center: Viewing banner */}
                <div className="flex items-center">
                    {isViewingOther && username && (
                        <ViewingUserBanner username={username} />
                    )}
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2">
                    {user && <NotificationButton />}
                    <AccountButton
                        showAuthModal={showAuthModal}
                        onOpenAuthModal={() => setShowAuthModal(true)}
                        onCloseAuthModal={() => setShowAuthModal(false)}
                        onOpenAdminDashboard={() => setShowAdminDashboard(true)}
                    />
                </div>
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
                    onNavigateToArtist={handleNavigateToArtist}
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
                focusedArtist={focusedArtist}
                onFocusedArtistHandled={() => setFocusedArtist(null)}
                focusedLocation={focusedLocation}
                onFocusedLocationHandled={() => setFocusedLocation(null)}
                focusedCityId={focusedCityId}
            />
        </div>
    );
};

export default App;
