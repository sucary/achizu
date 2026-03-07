import axios from 'axios';
import type { Artist, ArtistQueryParams } from '../types/artist';
import type { City } from '../types/city';
import type { MainSearchResponse } from '../types/search';
import { supabase } from '../lib/supabase';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export const checkHealth = async () => {
    try {
        const response = await api.get('/health');
        return response.data;
    } catch (error) {
        console.error('Health check failed:', error);
        throw error;
    }
};

export const getArtists = async (params?: ArtistQueryParams): Promise<Artist[]> => {
    try {
        const response = await api.get<Artist[]>('/artists', { params });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch artists:', error);
        throw error;
    }
};

export const getArtistsByUsername = async (username: string, params?: ArtistQueryParams): Promise<Artist[]> => {
    try {
        const response = await api.get<Artist[]>(`/artists/u/${username}`, { params });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch artists by username:', error);
        throw error;
    }
};

export const getCityById = async (id: string): Promise<City> => {
    try {
        const response = await api.get<City>(`/cities/${id}`);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch city:', error);
        throw error;
    }
};

export interface SearchResult {
    id?: string;
    displayName: string;
    name: string;
    province: string;
    country: string;
    center: { lat: number; lng: number };
    osmId: number;
    osmType: string;
    type?: string;
    importance?: number;
    isPriority?: boolean;
    isLocal?: boolean;
}

export interface SearchResponse {
    results: SearchResult[];
    source: 'local' | 'nominatim' | 'cache';
    hasMore: boolean;
}

export const searchCities = async (
    query: string,
    limit: number = 20,
    source: 'local' | 'nominatim' | 'auto' = 'auto',
    signal?: AbortSignal
): Promise<SearchResponse> => {
    try {
        const response = await api.get<SearchResponse>('/cities/search', {
            params: { q: query, limit, source },
            signal
        });
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) throw error;
        console.error('Failed to search cities:', error);
        throw error;
    }
};

// Search cities via Nominatim API
export const searchCitiesNominatim = async (query: string, limit: number = 20): Promise<SearchResponse> => {
    try {
        const response = await api.get<SearchResponse>('/cities/search/nominatim', {
            params: { q: query, limit }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to search cities via Nominatim:', error);
        throw error;
    }
};

// Reverse geocode coordinates to city
export const reverseGeocode = async (lat: number, lng: number, withBoundary: boolean = true): Promise<SearchResult> => {
    try {
        const params = withBoundary ? '?withBoundary=true' : '';
        const response = await api.post<SearchResult>(`/cities/reverse${params}`, { lat, lng });
        return response.data;
    } catch (error) {
        console.error('Failed to reverse geocode:', error);
        throw error;
    }
};

// Reverse search - get all matching boundaries for coordinates
export const reverseSearchCities = async (
    lat: number,
    lng: number,
    limit: number = 10,
    source: 'auto' | 'nominatim' = 'auto',
    signal?: AbortSignal
): Promise<SearchResponse> => {
    try {
        const response = await api.post<SearchResponse>(
            `/cities/reverse/search?limit=${limit}&source=${source}`,
            { lat, lng },
            { signal }
        );
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) throw error;
        console.error('Failed to reverse search:', error);
        throw error;
    }
};

// Create a new artist
export const createArtist = async (artistData: Partial<Artist>): Promise<Artist> => {
    try {
        const response = await api.post<Artist>('/artists', artistData);
        return response.data;
    } catch (error) {
        console.error('Failed to create artist:', error);
        throw error;
    }
};

// Update an existing artist
export const updateArtist = async (id: string, artistData: Partial<Artist>): Promise<Artist> => {
    try {
        const response = await api.put<Artist>(`/artists/${id}`, artistData);
        return response.data;
    } catch (error) {
        console.error('Failed to update artist:', error);
        throw error;
    }
};

// Delete an artist
export const deleteArtist = async (id: string): Promise<void> => {
    try {
        await api.delete(`/artists/${id}`);
    } catch (error) {
        console.error('Failed to delete artist:', error);
        throw error;
    }
};

// Main search across artists and locations
export const mainSearch = async (
    query: string,
    limit: number = 10,
    source: 'auto' | 'nominatim' = 'auto',
    excludeUser?: string,
    signal?: AbortSignal
): Promise<MainSearchResponse> => {
    try {
        const response = await api.get<MainSearchResponse>('/search', {
            params: { q: query, limit, source, excludeUser },
            signal
        });
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) throw error;
        console.error('Failed to search:', error);
        throw error;
    }
};

export default api;