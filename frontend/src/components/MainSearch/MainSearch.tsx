import { useRef, useEffect } from 'react';
import { useMainSearch } from './useMainSearch';
import { SearchResultRow } from './SearchResultRow';
import { SearchIcon, LoaderIcon, CloseIcon } from '../icons/FormIcons';
import type { ArtistSearchResult, LocationSearchResult } from '../../types/search';

interface MainSearchProps {
    onFocusArtist?: (result: ArtistSearchResult) => void;
    onFocusLocation?: (result: LocationSearchResult) => void;
}

export function MainSearch({ onFocusArtist, onFocusLocation }: MainSearchProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        query,
        setQuery,
        results,
        isLoading,
        isLoadingMore,
        hasMoreLocations,
        isOpen,
        setIsOpen,
        handleClear,
        handleSelectArtist,
        handleSelectLocation,
        handleSearchMore,
    } = useMainSearch({
        onAutoFocusArtist: onFocusArtist,
        onAutoFocusLocation: onFocusLocation,
    });

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setIsOpen]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
                inputRef.current?.blur();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, setIsOpen]);

    const hasResults = results && results.totalCount > 0;
    const showDropdown = isOpen && query.length >= 2;

    return (
        <div ref={containerRef} className="relative font-sans">
            {/* Search Input */}
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search artists, locations..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                    className="w-80 pl-9 pr-9 py-2 text-sm bg-surface border border-border rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-muted transition-colors text-text-secondary"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {showDropdown && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-surface border border-border rounded-md shadow-md overflow-hidden max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <LoaderIcon className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : !hasResults ? (
                        <div className="text-center py-8 text-text-secondary text-sm">
                            No results found
                        </div>
                    ) : (
                        <>
                            {/* Artists */}
                            {results.artists.length > 0 && (
                                <div>
                                    <div className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted">
                                        Artists
                                    </div>
                                    {results.artists.map((artist) => (
                                        <SearchResultRow
                                            key={artist.id}
                                            result={artist}
                                            onSelect={() => handleSelectArtist(artist)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Locations */}
                            {results.locations.length > 0 && (
                                <div>
                                    <div className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted">
                                        Locations
                                    </div>
                                    {results.locations.map((location) => (
                                        <SearchResultRow
                                            key={`${location.osmId}:${location.osmType}`}
                                            result={location}
                                            onSelect={() => handleSelectLocation(location)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Load more button */}
                            {hasMoreLocations && (
                                <button
                                    onClick={handleSearchMore}
                                    disabled={isLoadingMore}
                                    className="w-full px-4 py-2 text-center text-sm text-primary hover:bg-primary/5 border-t border-border font-medium disabled:opacity-50"
                                >
                                    {isLoadingMore ? 'Searching...' : 'Search for more locations'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
