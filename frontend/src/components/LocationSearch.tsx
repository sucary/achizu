import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, MapPinIcon, LoaderIcon, CloseIcon } from './Icons/FormIcons';
import { useLocationSearch } from '../hooks/useLocationSearch';
import type { SearchResult } from '../services/api';

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
    const {
        query,
        results,
        isOpen,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        debouncedQuery,
        setQuery,
        handleSelect,
        handleSearchMore,
        handleCancel,
        handleRetry,
        openDropdown,
        closeDropdown,
    } = useLocationSearch({
        displayValue,
        onChange,
        pendingCoordinates,
        onCoordinatesConsumed,
    });

    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);

    // Update dropdown position when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            // Find the outer form panel to cap dropdown within it
            const formContainer = inputRef.current.closest('.rounded-lg.shadow-xl');
            const containerBottom = formContainer
                ? formContainer.getBoundingClientRect().bottom
                : window.innerHeight;
            const gap = 4;
            const maxHeight = Math.max(120, containerBottom - rect.bottom - gap);
            
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                maxHeight
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
                closeDropdown();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [closeDropdown]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (query === null && displayValue) {
            setQuery(displayValue);
            setTimeout(() => e.target.select(), 0);
        } else if (query !== null && results.length > 0) {
            openDropdown();
        }
    };

    const showNoResults = isOpen && results.length === 0 && !isLoading && !error && query !== null && debouncedQuery.trim().length >= 2;

    return (
        <div>
            {label && (
                <label className="block text-sm font-bold text-text mb-1">
                    {label}
                </label>
            )}
            <div className="relative" ref={dropdownRef}>
                <div className="flex items-center gap-2" ref={inputRef}>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder={placeholder || "Search location..."}
                            className={`w-full pl-9 py-2 border border-border-strong rounded-md text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary ${isLoading ? 'pr-8' : 'pr-3'}`}
                            value={query !== null ? query : displayValue}
                            onChange={handleInputChange}
                            onFocus={handleInputFocus}
                        />
                        {isLoading ? (
                            <LoaderIcon className="absolute left-3 top-2.5 w-4 h-4 text-text-muted animate-spin" />
                        ) : (
                            <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
                        )}
                        {isLoading && (
                            <button
                                onClick={handleCancel}
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-error transition-colors"
                                title="Cancel search"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onManualPin}
                        type="button"
                        className="p-2 text-text-muted hover:text-primary transition-colors"
                        title="Manually select on map"
                    >
                        <MapPinIcon className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="mt-1 text-error text-sm flex items-center justify-between">
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

            {/* Dropdown Portal */}
            {isOpen && results.length > 0 && createPortal(
                <div
                    className="location-search-dropdown fixed z-[9999] bg-surface border border-border-strong rounded-md shadow-lg overflow-hidden"
                    style={{
                        top: `${dropdownPosition.top + 4}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`,
                        maxHeight: `${dropdownPosition.maxHeight}px`
                    }}
                >
                    <div className="overflow-y-auto" style={{ maxHeight: `${dropdownPosition.maxHeight - 2}px` }}>
                        {results.map((result, index) => (
                            <button
                                key={`${result.osmId}-${index}`}
                                onClick={() => handleSelect(result)}
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-secondary border-b border-border last:border-b-0"
                            >
                                <div className="font-medium text-text flex items-start">
                                    {result.isPriority && (
                                        <span className="inline-block w-2 h-2 bg-primary rounded-full mr-2 mt-1.5" />
                                    )}
                                    {result.displayName}
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                    {result.type && (
                                        <span className="text-xs text-text-secondary capitalize">{result.type}</span>
                                    )}
                                    {result.isLocal && (
                                        <span className="text-xs text-secondary bg-secondary/10 px-1.5 py-0.5 rounded ml-auto">DB</span>
                                    )}
                                </div>
                            </button>
                        ))}
                        {hasMore && (
                            <button
                                onClick={handleSearchMore}
                                type="button"
                                disabled={isLoadingMore}
                                className="w-full px-3 py-2 text-center text-sm text-primary hover:bg-primary/5 border-t border-border font-medium disabled:opacity-50"
                            >
                                {isLoadingMore ? 'Searching...' : 'Search for more results'}
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* No results Portal */}
            {showNoResults && createPortal(
                <div
                    className="location-search-dropdown fixed z-[9999] bg-surface border border-border-strong rounded-md shadow-lg p-3 text-sm text-text-secondary text-center"
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
