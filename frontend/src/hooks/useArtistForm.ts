import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createArtist, updateArtist } from '../services/api';
import type { SearchResult } from '../services/api';
import type { Artist } from '../types/artist';
import { extractLocationData, createEmptyLocation, hasValidCoordinates } from '../utils/locationUtils';

export interface UseArtistFormOptions {
    initialData?: Artist;
    onSuccess?: (artist: Artist) => void;
    onCancel?: () => void;
}

export interface UseArtistFormReturn {
    formData: Partial<Artist>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<Artist>>>;

    isSaving: boolean;
    error: string | null;
    pendingField: 'originalLocation' | 'activeLocation' | null;

    handleLocationSelect: (result: SearchResult, locationType: 'originalLocation' | 'activeLocation') => void;
    handleSave: () => Promise<void>;
    copyOriginalToActive: () => void;
    startManualPinSelection: (field: 'originalLocation' | 'activeLocation') => void;
    clearPendingField: () => void;
    clearError: () => void;
    updateSocialLink: (key: string, value: string) => void;
    updateName: (name: string) => void;
    updateProfilePicture: (url: string) => void;

    isEditing: boolean;
}

const createInitialFormData = (initialData?: Artist): Partial<Artist> => {
    if (initialData) return initialData;

    return {
        name: 'New Artist',
        profilePicture: '',
        originalLocation: createEmptyLocation(),
        activeLocation: createEmptyLocation(),
        socialLinks: {}
    };
};

export const useArtistForm = ({
    initialData,
    onSuccess,
    onCancel
}: UseArtistFormOptions): UseArtistFormReturn => {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState<Partial<Artist>>(() => createInitialFormData(initialData));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingField, setPendingField] = useState<'originalLocation' | 'activeLocation' | null>(null);

    const isEditing = Boolean(initialData?.id);

    const clearError = useCallback(() => setError(null), []);
    const clearPendingField = useCallback(() => setPendingField(null), []);

    const handleLocationSelect = useCallback((
        result: SearchResult,
        locationType: 'originalLocation' | 'activeLocation'
    ) => {
        const locationData = extractLocationData(result);
        setFormData(prev => ({
            ...prev,
            [locationType]: locationData
        }));
        setError(null);
    }, []);

    const copyOriginalToActive = useCallback(() => {
        setFormData(prev => ({
            ...prev,
            activeLocation: prev.originalLocation
        }));
    }, []);

    const startManualPinSelection = useCallback((field: 'originalLocation' | 'activeLocation') => {
        setPendingField(field);
    }, []);

    const updateSocialLink = useCallback((key: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            socialLinks: { ...prev.socialLinks, [key]: value }
        }));
    }, []);

    const updateName = useCallback((name: string) => {
        setFormData(prev => ({ ...prev, name }));
    }, []);

    const updateProfilePicture = useCallback((url: string) => {
        setFormData(prev => ({ ...prev, profilePicture: url }));
    }, []);

    const validateForm = useCallback((): string | null => {
        if (!formData.name || formData.name.trim() === '' || formData.name === 'New Artist') {
            return 'Artist name is required';
        }

        if (!hasValidCoordinates(formData.originalLocation)) {
            return 'Original location is required';
        }

        if (!hasValidCoordinates(formData.activeLocation)) {
            return 'Active location is required';
        }

        return null;
    }, [formData.name, formData.originalLocation, formData.activeLocation]);

    const handleSave = useCallback(async () => {
        setError(null);

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSaving(true);

        try {
            let savedArtist: Artist;

            if (initialData?.id) {
                savedArtist = await updateArtist(initialData.id, formData);
            } else {
                savedArtist = await createArtist(formData);
            }

            await queryClient.invalidateQueries({ queryKey: ['artists'] });

            onSuccess?.(savedArtist);
            onCancel?.();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
            let errorMessage = 'Failed to save artist. Please try again.';

            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }

            setError(errorMessage);
        } finally {
            setIsSaving(false);
        }
    }, [formData, initialData?.id, validateForm, queryClient, onSuccess, onCancel]);

    return {
        formData,
        setFormData,
        isSaving,
        error,
        pendingField,
        handleLocationSelect,
        handleSave,
        copyOriginalToActive,
        startManualPinSelection,
        clearPendingField,
        clearError,
        updateSocialLink,
        updateName,
        updateProfilePicture,
        isEditing
    };
};

/**
 * Hook to handle the map selection flow coordination.
 * Keeps the useEffect logic isolated and properly handles dependencies.
 */
export const useMapSelectionHandler = (
    pendingField: 'originalLocation' | 'activeLocation' | null,
    pendingLocationResult: SearchResult | null | undefined,
    onLocationSelect: (result: SearchResult, field: 'originalLocation' | 'activeLocation') => void,
    onComplete: () => void,
    onConsumePendingResult?: () => void
) => {
    useEffect(() => {
        if (pendingField && pendingLocationResult !== undefined) {
            if (pendingLocationResult) {
                onLocationSelect(pendingLocationResult, pendingField);
            }
            onComplete();
            onConsumePendingResult?.();
        }
    }, [pendingField, pendingLocationResult, onLocationSelect, onComplete, onConsumePendingResult]);
};
