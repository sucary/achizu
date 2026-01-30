import axios from 'axios';
import type { Artist, ArtistQueryParams } from '../types/artist';
import type { City } from '../types/city';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
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
}

export interface SearchResponse {
    results: SearchResult[];
    source: 'local' | 'nominatim';
    hasMore?: boolean;
}

// Search cities in local database
export const searchCities = async (query: string, limit: number = 20): Promise<SearchResponse> => {
    try {
        const response = await api.get<SearchResponse>('/cities/search', {
            params: { q: query, limit }
        });
        return response.data;
    } catch (error) {
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

export default api;