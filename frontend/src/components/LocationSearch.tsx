import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, MapPinIcon, LoaderIcon } from './Icons/FormIcons';
import { searchCities, searchCitiesNominatim, type SearchResult } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';

interface LocationSearchProps {
    displayValue?: string;
    onChange: (result: SearchResult) => void;
    onManualPin: () => void;
    placeholder?: string;
    label?: string;
}

export const LocationSearch = ({ displayValue = '', onChange, onManualPin, placeholder, label }: LocationSearchProps) => {
    const [query, setQuery] = useState<string | null>(null);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [source, setSource] = useState<'local' | 'nominatim'>('local');
    const [hasMore, setHasMore] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);

    const debouncedQuery = useDebounce(query ?? '', 1000);

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

    const handleSearch = async (searchQuery: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await searchCities(searchQuery);
            setResults(response.results);
            setSource(response.source);
            setHasMore(response.hasMore || false);
            setIsOpen(true);

            // Auto-search Nominatim if local DB has no results
            if (response.results.length === 0) {
                await handleSearchNominatim(searchQuery);
            }
        } catch (err) {
            setError('Failed to search locations. Please try again.');
            console.error('Search failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchNominatim = async (searchQuery?: string) => {
        const queryToSearch = searchQuery || debouncedQuery.trim();
        if (queryToSearch.length < 2) return;

        setIsLoading(true);
        setError(null);
        try {
            const response = await searchCitiesNominatim(queryToSearch);
            setResults(response.results);
            setSource('nominatim');
            setHasMore(false);
            setIsOpen(true);
        } catch (err) {
            setError('Failed to search Nominatim. Please try again.');
            console.error('Nominatim search failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (result: SearchResult) => {
        onChange(result);
        setIsOpen(false);
        setQuery(null);
        setError(null);
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
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FA2D48] focus:ring-1 focus:ring-inset focus:ring-[#FA2D48]"
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
                        className="p-2 text-gray-400 hover:text-[#FA2D48] transition-colors"
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
                            className="ml-2 text-[#FA2D48] hover:underline"
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
                    {source === 'local' && (
                        <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 border-b">
                            From your database
                        </div>
                    )}

                    {results.map((result, index) => (
                        <button
                            key={`${result.osmId}-${index}`}
                            onClick={() => handleSelect(result)}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                            <div className="font-medium text-gray-900 flex items-center">
                                {result.isPriority && (
                                    <span className="inline-block w-2 h-2 bg-[#FA2D48] rounded-full mr-2" />
                                )}
                                {result.displayName}
                            </div>
                            {result.type && (
                                <div className="text-xs text-gray-500 capitalize mt-0.5">{result.type}</div>
                            )}
                        </button>
                    ))}

                    {source === 'local' && hasMore && (
                        <button
                            onClick={() => handleSearchNominatim()}
                            disabled={isLoading}
                            type="button"
                            className="w-full px-3 py-2 text-sm text-[#FA2D48] hover:bg-gray-50 font-medium border-t disabled:opacity-50"
                        >
                            {isLoading ? 'Searching...' : 'Search Nominatim for more'}
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
