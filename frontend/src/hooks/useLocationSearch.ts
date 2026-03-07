import { useReducer, useRef, useEffect, useCallback, useMemo } from 'react';
import { reverseSearchCities, type SearchResult } from '../services/api';
import { LocationSearchService } from '../services/LocationSearchService';
import { locationSearchReducer, initialState } from './locationSearchReducer';

interface UseLocationSearchProps {
    displayValue?: string;
    onChange: (result: SearchResult) => void;
    pendingCoordinates?: { lat: number; lng: number } | null;
    onCoordinatesConsumed?: () => void;
}

export function useLocationSearch({
    displayValue = '',
    onChange,
    pendingCoordinates,
    onCoordinatesConsumed,
}: UseLocationSearchProps) {
    const [state, dispatch] = useReducer(locationSearchReducer, initialState);

    // Create service with callbacks that dispatch to reducer
    const service = useMemo(() => new LocationSearchService({
        onStart: (isMore) => dispatch({ type: 'SEARCH_START', isMore }),
        onSuccess: (response) => dispatch({
            type: 'SEARCH_SUCCESS',
            results: response.results,
            source: response.source,
            hasMore: response.hasMore,
        }),
        onError: (error) => dispatch({ type: 'SEARCH_ERROR', error }),
    }), []);

    // Cleanup service on unmount
    useEffect(() => {
        return () => service.destroy();
    }, [service]);

    // Public handlers
    const handleCancel = useCallback(() => {
        service.cancel();
        dispatch({ type: 'SEARCH_CANCEL' });
    }, [service]);

    const handleSelect = useCallback((result: SearchResult) => {
        const finalResult = state.clickedCoords
            ? { ...result, center: state.clickedCoords }
            : result;
        onChange(finalResult);
        dispatch({ type: 'RESET_QUERY' });
    }, [state.clickedCoords, onChange]);

    const handleSearch = useCallback(() => {
        const searchQuery = state.query ?? '';
        if (searchQuery.trim().length >= 2) {
            service.search(searchQuery.trim());
        }
    }, [service, state.query]);

    const handleSearchMore = useCallback(() => {
        if (state.clickedCoords) {
            service.reverseSearch(state.clickedCoords.lat, state.clickedCoords.lng, 'nominatim');
        } else {
            const searchQuery = state.query ?? '';
            if (searchQuery.trim().length >= 2) {
                service.search(searchQuery.trim(), 'nominatim');
            }
        }
    }, [service, state.clickedCoords, state.query]);

    const handleRetry = useCallback(() => {
        const queryToRetry = state.query ?? '';
        if (queryToRetry.trim().length >= 2) {
            service.search(queryToRetry.trim());
        }
    }, [service, state.query]);

    const setQuery = useCallback((query: string | null) => {
        dispatch({ type: 'SET_QUERY', query });
        if (query !== null && query.trim().length < 2) {
            dispatch({ type: 'CLOSE_DROPDOWN' });
        }
    }, []);

    const openDropdown = useCallback(() => dispatch({ type: 'OPEN_DROPDOWN' }), []);
    const closeDropdown = useCallback(() => dispatch({ type: 'CLOSE_DROPDOWN' }), []);

    // Effect: handle pending coordinates from manual map pin
    useEffect(() => {
        if (!pendingCoordinates) return;

        dispatch({ type: 'SET_CLICKED_COORDS', coords: pendingCoordinates });

        const handleReverseSearch = async () => {
            if (service.searching) {
                service.reverseSearch(pendingCoordinates.lat, pendingCoordinates.lng, 'auto');
                onCoordinatesConsumed?.();
                return;
            }

            dispatch({ type: 'SEARCH_START', isMore: false });

            try {
                const response = await reverseSearchCities(
                    pendingCoordinates.lat,
                    pendingCoordinates.lng,
                    10,
                    'auto'
                );

                if (response.results.length === 1) {
                    const result = response.results[0];
                    onChange({ ...result, center: pendingCoordinates });
                    dispatch({ type: 'RESET_QUERY' });
                } else {
                    dispatch({
                        type: 'SEARCH_SUCCESS',
                        results: response.results,
                        source: response.source,
                        hasMore: response.hasMore,
                    });
                    dispatch({ type: 'SET_QUERY', query: null });
                }
            } catch (err) {
                dispatch({ type: 'SEARCH_ERROR', error: 'No locations found at this point. Try another spot.' });
                console.error('Reverse search failed:', err);
            } finally {
                onCoordinatesConsumed?.();
            }
        };

        handleReverseSearch();
    }, [pendingCoordinates, onCoordinatesConsumed, onChange, service]);

    // Effect: reset query when displayValue changes externally
    const prevDisplayValue = useRef(displayValue);
    useEffect(() => {
        if (prevDisplayValue.current !== displayValue) {
            prevDisplayValue.current = displayValue;
            dispatch({ type: 'RESET_QUERY' });
        }
    }, [displayValue]);

    return {
        query: state.query,
        results: state.results,
        isOpen: state.isOpen,
        isLoading: state.isLoading,
        isLoadingMore: state.isLoadingMore,
        error: state.error,
        hasMore: state.hasMore,

        setQuery,
        handleSearch,
        handleSelect,
        handleSearchMore,
        handleCancel,
        handleRetry,
        openDropdown,
        closeDropdown,
    };
}
