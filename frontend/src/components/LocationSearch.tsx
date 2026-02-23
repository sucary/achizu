import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, MapPinIcon, LoaderIcon } from './Icons/FormIcons';
import { searchCities, reverseSearchCities, type SearchResult } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';

interface LocationSearchProps {
    displayValue?: string;
    onChange: (result: SearchResult) => void;
    onManualPin: () => void;
    placeholder?: string;
    label?: string;
    pendingCoordinates?: { lat: number; lng: number } | null;
    onCoordinatesConsumed?: () => void;
}

export const LocationSearch = ({
    displayValue = '',
    onChange,
    onManualPin,
    placeholder,
    label,
    pendingCoordinates,
    onCoordinatesConsumed
}: LocationSearchProps) => {
    const [query, setQuery] = useState<string | null>(null);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [source, setSource] = useState<'local' | 'nominatim' | 'cache'>('local');
    const [hasMore, setHasMore] = useState(false);
    const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);

    const debouncedQuery = useDebounce(query ?? '', 1000);

    // Handle pending coordinates from manual map pin
    useEffect(() => {
        if (!pendingCoordinates) return;

        const handleReverseSearch = async () => {
            setIsLoading(true);
            setError(null);
            setClickedCoords(pendingCoordinates);

            try {
                const response = await reverseSearchCities(pendingCoordinates.lat, pendingCoordinates.lng);

                // If only one result, auto-select it
                if (response.results.length === 1) {
                    const result = response.results[0];
                    const finalResult = { ...result, center: pendingCoordinates };
                    onChange(finalResult);
                    setIsOpen(false);
                    setClickedCoords(null);
                    setQuery(null);
                } else {
                    // Multiple results - show dropdown for user to choose
                    setResults(response.results);
                    setSource(response.source);
                    setHasMore(response.hasMore);
                    setIsOpen(true);
                    setQuery(null);
                }
            } catch (err) {
                setError('No locations found at this point. Try another spot.');
                console.error('Reverse search failed:', err);
            } finally {
                setIsLoading(false);
                onCoordinatesConsumed?.();
            }
        };

        handleReverseSearch();
    }, [pendingCoordinates, onCoordinatesConsumed, onChange]);

    // Reset internal query when displayValue is changed externally (e.g. copy original to active)
    const prevDisplayValue = useRef(displayValue);
    useEffect(() => {
        if (prevDisplayValue.current !== displayValue) {
            prevDisplayValue.current = displayValue;
            setQuery(null);
            setIsOpen(false);
            setClickedCoords(null);
        }
    }, [displayValue]);

    // Update dropdown position when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            const clickedInside = dropdownRef.current?.contains(target);
            const clickedOnDropdown = document.querySelector('.location-search-dropdown')?.contains(target);

            if (!clickedInside && !clickedOnDropdown) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search when debounced query changes
    useEffect(() => {
        if (query === null) return;

        const trimmedQuery = debouncedQuery.trim();
        if (trimmedQuery.length >= 2) {
            handleSearch(trimmedQuery);
        } else if (trimmedQuery.length === 0) {
            setResults([]);
            setIsOpen(false);
            setError(null);
        }

    }, [debouncedQuery]);

    const handleSearch = async (searchQuery: string, searchSource: 'auto' | 'nominatim' = 'auto') => {
        if (searchSource === 'nominatim') {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const response = await searchCities(searchQuery, 20, searchSource);
            setResults(response.results);
            setSource(response.source);
            setHasMore(response.hasMore);
            setIsOpen(true);
        } catch (err) {
            setError('Failed to search locations. Please try again.');
            console.error('Search failed:', err);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const handleSearchMore = async () => {
        setIsLoadingMore(true);
        setError(null);

        try {
            // If we have clicked coordinates, this is a reverse search
            if (clickedCoords) {
                const response = await reverseSearchCities(
                    clickedCoords.lat,
                    clickedCoords.lng,
                    20,
                    'nominatim'
                );
                setResults(response.results);
                setSource(response.source);
                setHasMore(response.hasMore);
            } else {
                // Normal text search
                const searchQuery = query ?? debouncedQuery;
                if (searchQuery.trim().length >= 2) {
                    const response = await searchCities(searchQuery.trim(), 20, 'nominatim');
                    setResults(response.results);
                    setSource(response.source);
                    setHasMore(response.hasMore);
                }
            }
        } catch (err) {
            setError('Failed to search for more results.');
            console.error('Search more failed:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleSelect = (result: SearchResult) => {
        // If we have clicked coordinates (from manual pin), use those instead of city center
        const finalResult = clickedCoords
            ? { ...result, center: clickedCoords }
            : result;
        onChange(finalResult);
        setIsOpen(false);
        setQuery(null);
        setError(null);
        setClickedCoords(null);
    };

    const handleRetry = () => {
        const queryToRetry = query ?? '';
        if (queryToRetry.trim().length >= 2) {
            handleSearch(queryToRetry.trim());
        }
    };

    return (
        <div className="mb-4">
            {label && (
                <label className="block text-sm font-bold text-gray-700 mb-1">
                    {label}
                </label>
            )}
            <div className="relative" ref={dropdownRef}>
                <div className="flex items-center gap-2" ref={inputRef}>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder={placeholder || "Search location..."}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                            value={query !== null ? query : displayValue}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                // Close dropdown when typing
                                if (e.target.value.trim().length < 2) {
                                    setIsOpen(false);
                                }
                            }}
                            onFocus={(e) => {
                                // If showing value from parent, initialize query for editing
                                if (query === null && displayValue) {
                                    setQuery(displayValue);
                                    setTimeout(() => e.target.select(), 0);
                                } else if (query !== null && results.length > 0) {
                                    setIsOpen(true);
                                }
                            }}
                        />
                        {isLoading ? (
                            <LoaderIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 animate-spin" />
                        ) : (
                            <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        )}
                    </div>
                    <button
                        onClick={onManualPin}
                        type="button"
                        className="p-2 text-gray-400 hover:text-primary transition-colors"
                        title="Manually select on map"
                    >
                        <MapPinIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Error message */}
                {error && (
                    <div className="mt-1 text-red-500 text-sm flex items-center justify-between">
                        <span>{error}</span>
                        <button
                            onClick={handleRetry}
                            className="ml-2 text-primary hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                )}
            </div>

            {/* Dropdown Portal*/}
            {isOpen && results.length > 0 && createPortal(
                <div
                    className="location-search-dropdown fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto"
                    style={{
                        top: `${dropdownPosition.top + 4}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`
                    }}
                >
                    {results.map((result, index) => (
                        <button
                            key={`${result.osmId}-${index}`}
                            onClick={() => handleSelect(result)}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                            <div className="font-medium text-gray-900 flex items-start">
                                {result.isPriority && (
                                    <span className="inline-block w-2 h-2 bg-primary rounded-full mr-2 mt-1.5" />
                                )}
                                {result.displayName}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                                {result.type && (
                                    <span className="text-xs text-gray-500 capitalize">{result.type}</span>
                                )}
                                {result.isLocal && (
                                    <span className="text-xs text-secondary bg-secondary/10 px-1.5 py-0.5 rounded ml-auto">DB</span>
                                )}
                            </div>
                        </button>
                    ))}
                    {/* Search more button */}
                    {hasMore && (
                        <button
                            onClick={handleSearchMore}
                            type="button"
                            disabled={isLoadingMore}
                            className="w-full px-3 py-2 text-center text-sm text-primary hover:bg-primary/5 border-t border-gray-200 font-medium disabled:opacity-50"
                        >
                            {isLoadingMore ? 'Searching...' : 'Search for more results'}
                        </button>
                    )}
                </div>,
                document.body
            )}

            {/* No results Portal */}
            {isOpen && results.length === 0 && !isLoading && !error && query !== null && debouncedQuery.trim().length >= 2 && createPortal(
                <div
                    className="location-search-dropdown fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg p-3 text-sm text-gray-500 text-center"
                    style={{
                        top: `${dropdownPosition.top + 4}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`
                    }}
                >
                    No results found
                </div>,
                document.body
            )}
        </div>
    );
};
