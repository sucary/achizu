import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getArtists, getArtistsByUsername } from '../services/api';
import { SearchIcon, MapPinIcon, EditIcon, TrashIcon } from './icons/FormIcons';
import { getAvatarUrl } from '../utils/cloudinaryUrl';
import { formatLocation } from '../utils/locationUtils';
import { Input, IconButton, Spinner, CloseButton } from './ui';
import ArtistProfile from './ArtistProfile';
import type { Artist } from '../types/artist';

interface ArtistListProps {
    username?: string;
    onClose: () => void;
    onNavigateToArtist?: (artist: Artist) => void;
    onEditArtist?: (artist: Artist) => void;
    onDeleteArtist?: (artist: Artist) => void;
}

const getPlaceholderUrl = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=150&background=e5e7eb&color=9ca3af`;

const ArtistList = ({ username, onClose, onNavigateToArtist, onEditArtist, onDeleteArtist }: ArtistListProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
    const [cardPosition, setCardPosition] = useState<number>(0);
    const listRef = useRef<HTMLDivElement>(null);

    const { data: artists = [], isLoading } = useQuery({
        queryKey: ['artists', username],
        queryFn: () => username ? getArtistsByUsername(username) : getArtists(),
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
                <CloseButton onClick={onClose} size="md" />
            </div>

            {/* Search */}
            <div className="px-4 py-2">
                <Input
                    type="text"
                    placeholder="Search artists or cities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    rightIcon={<SearchIcon className="w-4 h-4" />}
                />
            </div>

            {/* Artist list - max 8 rows visible */}
            <div className="overflow-y-auto flex-1 max-h-[32rem]">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Spinner className="text-primary" />
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
                                            {formatLocation(artist.activeLocation)}
                                        </p>
                                    </div>
                                    {/* Actions */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onNavigateToArtist && (
                                            <IconButton
                                                onClick={(e) => { e.stopPropagation(); onNavigateToArtist(artist); }}
                                                size="sm"
                                                className="rounded hover:bg-primary hover:text-white text-text-secondary"
                                                title="Go to location"
                                            >
                                                <MapPinIcon className="w-4 h-4" />
                                            </IconButton>
                                        )}
                                        {onEditArtist && (
                                            <IconButton
                                                onClick={(e) => { e.stopPropagation(); onEditArtist(artist); }}
                                                size="sm"
                                                className="rounded hover:bg-primary hover:text-white text-text-secondary"
                                                title="Edit"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </IconButton>
                                        )}
                                        {onDeleteArtist && (
                                            <IconButton
                                                onClick={(e) => { e.stopPropagation(); onDeleteArtist(artist); }}
                                                size="sm"
                                                className="rounded hover:bg-error hover:text-white text-text-secondary"
                                                title="Delete"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </IconButton>
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
