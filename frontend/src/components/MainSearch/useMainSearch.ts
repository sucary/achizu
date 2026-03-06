import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchUnified } from '../../services/api';
import type { UnifiedSearchResponse, ArtistSearchResult, LocationSearchResult } from '../../types/search';

interface UseMainSearchOptions {
    onAutoFocusArtist?: (result: ArtistSearchResult) => void;
    onAutoFocusLocation?: (result: LocationSearchResult) => void;
}

export function useMainSearch(options: UseMainSearchOptions = {}) {
    const { onAutoFocusArtist, onAutoFocusLocation } = options;
    const queryClient = useQueryClient();

    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const autoFocusTriggered = useRef(false);

    // Debounce the query
    useEffect(() => {
        autoFocusTriggered.current = false;
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Open dropdown when query is entered
    useEffect(() => {
        if (query.length >= 2) {
            setIsOpen(true);
        }
    }, [query]);

    const { data: results, isLoading, isFetching } = useQuery<UnifiedSearchResponse>({
        queryKey: ['unifiedSearch', debouncedQuery],
        queryFn: () => searchUnified(debouncedQuery),
        enabled: debouncedQuery.length >= 2,
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });

    // Auto-focus when single artist result
    useEffect(() => {
        if (!results || autoFocusTriggered.current) return;

        if (results.artists.length === 1 && results.locations.length === 0) {
            autoFocusTriggered.current = true;
            onAutoFocusArtist?.(results.artists[0]);
            setIsOpen(false);
        }
    }, [results, onAutoFocusArtist]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    const handleClear = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
        setIsOpen(false);
    }, []);

    const handleSelectArtist = useCallback((result: ArtistSearchResult) => {
        onAutoFocusArtist?.(result);
        setIsOpen(false);
    }, [onAutoFocusArtist]);

    const handleSelectLocation = useCallback((result: LocationSearchResult) => {
        onAutoFocusLocation?.(result);
        setIsOpen(false);
    }, [onAutoFocusLocation]);

    const handleSearchMore = useCallback(async () => {
        if (!debouncedQuery || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const moreResults = await searchUnified(debouncedQuery, 10, 'nominatim');
            // Update the cache with the new results
            queryClient.setQueryData(['unifiedSearch', debouncedQuery], moreResults);
        } catch (error) {
            console.error('Failed to load more results:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [debouncedQuery, isLoadingMore, queryClient]);

    return {
        query,
        setQuery,
        results,
        isLoading: isLoading || isFetching,
        isLoadingMore,
        hasMoreLocations: results?.hasMoreLocations ?? false,
        isOpen,
        setIsOpen,
        handleClose,
        handleClear,
        handleSelectArtist,
        handleSelectLocation,
        handleSearchMore,
    };
}
