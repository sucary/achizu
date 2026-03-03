import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getArtists } from '../services/api';
import { CloseIcon, SearchIcon, LoaderIcon, MapPinIcon } from './Icons/FormIcons';
import { getAvatarUrl } from '../utils/cloudinaryUrl';
import ArtistProfile from './ArtistProfile';
import type { Artist } from '../types/artist';

interface ArtistListProps {
    onClose: () => void;
    onNavigateToArtist?: (artist: Artist) => void;
    onEditArtist?: (artist: Artist) => void;
    onDeleteArtist?: (artist: Artist) => void;
}

const getPlaceholderUrl = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=150&background=e5e7eb&color=9ca3af`;

const ArtistList = ({ onClose, onNavigateToArtist, onEditArtist, onDeleteArtist }: ArtistListProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
    const [cardPosition, setCardPosition] = useState<number>(0);
    const listRef = useRef<HTMLDivElement>(null);

    const { data: artists = [], isLoading } = useQuery({
        queryKey: ['artists'],
        queryFn: () => getArtists(),
    });

    const filteredArtists = artists.filter((artist) =>
        artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artist.activeLocation.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artist.originalLocation.city.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleRowClick = (artist: Artist, e: React.MouseEvent<HTMLDivElement>) => {
        // Get the row's position relative to the wrapper
        const rowRect = e.currentTarget.getBoundingClientRect();
        const wrapperRect = listRef.current?.getBoundingClientRect();
        if (wrapperRect) {
            // Calculate position relative to wrapper, centered on the row
            const rowCenterY = rowRect.top - wrapperRect.top + rowRect.height / 2;
            setCardPosition(rowCenterY);
        }
        setSelectedArtist(selectedArtist?.id === artist.id ? null : artist);
    };

    return (
        <div ref={listRef} className="absolute top-28 right-2 z-[1050] font-sans">
            {/* Artist card - positioned to the left of the list */}
            {selectedArtist && (
                <div
                    className="absolute right-full mr-2"
                    style={{ top: cardPosition, transform: 'translateY(-50%)' }}
                >
                    <ArtistProfile artist={selectedArtist} />
                </div>
            )}

            {/* Main list panel */}
            <div className="w-80 bg-surface rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="text-lg font-semibold text-text">Artists ({artists.length})</h2>
                <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-surface-muted transition-colors text-text-secondary"
                >
                    <CloseIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input
                        type="text"
                        placeholder="Search artists or cities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-surface-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>
            </div>

            {/* Artist list */}
            <div className="overflow-y-auto flex-1">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <LoaderIcon className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : filteredArtists.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">
                        {searchQuery ? 'No artists found' : 'No artists added yet'}
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {filteredArtists.map((artist) => (
                            <li key={artist.id} className="group">
                                <div
                                    onClick={(e) => handleRowClick(artist, e)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors cursor-pointer ${selectedArtist?.id === artist.id ? 'bg-surface-muted' : ''}`}
                                >
                                    {/* Avatar */}
                                    <img
                                        src={getAvatarUrl(artist.sourceImage, artist.avatarCrop) || getPlaceholderUrl(artist.name)}
                                        alt={artist.name}
                                        className="w-10 h-10 rounded-full object-cover border border-border"
                                    />
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-sm font-medium text-text truncate select-text cursor-text w-fit"
                                        >
                                            {artist.name}
                                        </p>
                                        <p
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-xs text-text-secondary truncate select-text cursor-text w-fit"
                                        >
                                            {artist.activeLocation.city}, {artist.activeLocation.province}
                                        </p>
                                    </div>
                                    {/* Actions */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onNavigateToArtist && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onNavigateToArtist(artist); }}
                                                className="p-1.5 rounded hover:bg-primary hover:text-white transition-colors text-text-secondary"
                                                title="Go to location"
                                            >
                                                <MapPinIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        {onEditArtist && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEditArtist(artist); }}
                                                className="p-1.5 rounded hover:bg-primary hover:text-white transition-colors text-text-secondary"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>
                                        )}
                                        {onDeleteArtist && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteArtist(artist); }}
                                                className="p-1.5 rounded hover:bg-error hover:text-white transition-colors text-text-secondary"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            </div>
        </div>
    );
};

export default ArtistList;
