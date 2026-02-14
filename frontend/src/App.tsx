import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import './App.css';
import { checkHealth, deleteArtist, type SearchResult } from './services/api';
import MapView from './components/Map/MapView';
import ArtistForm from './components/ArtistForm';
import AddArtistButton from './components/Map/buttons/AddArtistButton';
import { AccountButton } from './components/Auth/AccountButton';
import { ApprovalPending } from './components/Auth/ApprovalPending';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { useAuth } from './context/AuthContext';
import type { Artist, SelectionMode } from './types/artist';

function App() {
    const queryClient = useQueryClient();
    const { user, profile } = useAuth();
    const [status, setStatus] = useState<string>('Checking connection...');
    const [showForm, setShowForm] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showAdminDashboard, setShowAdminDashboard] = useState(false);
    const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
    const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);
    const [pendingLocationResult, setPendingLocationResult] = useState<SearchResult | null | undefined>(undefined);

    useEffect(() => {
        let mounted = true;

        const verifyConnection = async () => {
            try {
                const data = await checkHealth();
                if (mounted) 
                    {setStatus(data.message);
                }
            } catch (error) {
                if (mounted) {
                    setStatus('Connection failed. Is the backend running?');
                    console.error(error);
                }
            }
        };

        verifyConnection();

        return () => {
            mounted = false;
        };
    }, []);

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

    /*
        TODO
            - Make shadowing consistent (shadow-xl/30 vs shadow-md)
            - Add a proper locate icon instead of "X"


    */

    return (
        <div className="h-screen w-screen flex flex-col">
            {/* Status bar */}
            <div className="absolute top-2 left-2 z-[1000] bg-white p-2 rounded-md shadow-md">
                <div className="text-xs">
                    Backend: <span className={`font-bold ${status.includes('running') ? 'text-green-600' : 'text-red-600'}`}>
                        {status}
                    </span>
                </div>
            </div>

            <AccountButton
                showAuthModal={showAuthModal}
                onOpenAuthModal={() => setShowAuthModal(true)}
                onCloseAuthModal={() => setShowAuthModal(false)}
                onOpenAdminDashboard={() => setShowAdminDashboard(true)}
            />

            {user && profile && !profile.isApproved && <ApprovalPending />}

            {!showForm && <AddArtistButton onClick={handleAddArtistClick} />}
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
                selectionMode={selectionMode}
                onLocationPick={handleLocationPick}
                onEditArtist={handleEditArtist}
                onDeleteArtist={handleDeleteArtist}
                onEmptyClick={showForm ? handleCloseForm : undefined}
            />
        </div>
    );
};

export default App;
