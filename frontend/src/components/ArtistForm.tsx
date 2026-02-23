import { useState, useRef } from 'react';
import { ChevronDownIcon, ArrowDownIcon } from './Icons/FormIcons';
import { HomeIcon, MusicIcon, YoutubeIcon, InstagramIcon, XIcon } from './Icons/SocialIcons';
import { LocationSearch } from './LocationSearch';
import SocialLinkInput, { type SocialLinkField } from './SocialLinkInput';
import ImageCropper, { type CropResult } from './ImageCropper';
import ArtistFormHeader from './ArtistFormHeader';
import { useArtistForm } from '../hooks/useArtistForm';
import { getAvatarUrl, getProfileUrl } from '../utils/cloudinaryUrl';
import type { SearchResult } from '../services/api';
import type { Artist } from '../types/artist';


interface ArtistFormProps {
    initialData?: Artist;
    onSubmit?: (data: Partial<Artist>) => void;
    onCancel?: () => void;
    onRequestSelection?: (targetField: 'originalLocation' | 'activeLocation') => void;
    pendingCoordinates?: { lat: number; lng: number } | null;
    onConsumePendingCoordinates?: () => void;
}

const SOCIAL_FIELDS: SocialLinkField[] = [
    { key: 'website', icon: HomeIcon, placeholder: 'Website URL' },
    { key: 'instagram', icon: InstagramIcon, placeholder: 'Instagram URL' },
    { key: 'twitter', icon: XIcon, placeholder: 'Twitter/X URL' },
    { key: 'appleMusic', icon: MusicIcon, placeholder: 'Apple Music URL' },
    { key: 'youtube', icon: YoutubeIcon, placeholder: 'YouTube URL' },
];

const ArtistForm = ({
    initialData,
    onSubmit,
    onCancel,
    onRequestSelection,
    pendingCoordinates,
    onConsumePendingCoordinates
}: ArtistFormProps) => {
    const [isSocialExpanded, setIsSocialExpanded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [cropperInitialMode, setCropperInitialMode] = useState<'avatar' | 'profile'>('avatar');

    // Cropper state - simplified: just need to know if it's open and have the image
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);

    const {
        formData,
        isSaving,
        error,
        pendingField,
        isUploadingImage,
        uploadError,
        handleLocationSelect,
        handleSave,
        copyOriginalToActive,
        startManualPinSelection,
        clearPendingField,
        updateSocialLink,
        updateName,
        handleImageUpload,
        updateCrops,
    } = useArtistForm({
        initialData,
        onSuccess: onSubmit,
        onCancel
    });

    const handleManualPin = (locationType: 'originalLocation' | 'activeLocation') => {
        startManualPinSelection(locationType);
        onRequestSelection?.(locationType);
    };

    // Get pending coordinates for the correct field
    const getPendingCoordinatesFor = (field: 'originalLocation' | 'activeLocation') => {
        return pendingField === field ? pendingCoordinates : null;
    };

    // Handle consuming coordinates for a specific field
    const handleCoordinatesConsumed = () => {
        clearPendingField();
        onConsumePendingCoordinates?.();
    };

    const getLocationDisplayValue = (location?: { displayName?: string; city?: string; province?: string; country?: string }) => {
        if (!location) return '';
        if (location.displayName) return location.displayName;
        if (location.city) {
            const parts = [location.city];
            if (location.province) parts.push(location.province);
            if (location.country) parts.push(location.country);
            return parts.join(', ');
        }
        return '';
    };

    
    const openCropper = (initialMode: 'avatar' | 'profile') => {
        setCropperInitialMode(initialMode);

        if (formData.sourceImage) {
            setCropperImageSrc(formData.sourceImage);
            setIsCropperOpen(true);
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleAvatarClick = () => {
        openCropper('avatar');
    };

    const handleProfileClick = () => {
        openCropper('profile');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Upload to Cloudinary first
        const imageUrl = await handleImageUpload(file);

        if (imageUrl) {
            // Open cropper with the uploaded image
            setCropperImageSrc(imageUrl);
            setIsCropperOpen(true);
        }

        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCropSave = (result: CropResult) => {
        updateCrops(result.avatarCrop, result.profileCrop);
        setIsCropperOpen(false);
        setCropperImageSrc(null);
    };

    const handleCropperCancel = () => {
        setIsCropperOpen(false);
        setCropperImageSrc(null);
    };

    // Get display URLs using Cloudinary transformations
    const avatarUrl = getAvatarUrl(formData.sourceImage, formData.avatarCrop);
    const profileUrl = getProfileUrl(formData.sourceImage, formData.profileCrop);

    return (
        <>
        {/* Hidden file input */}
        <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
        />

        {isCropperOpen && cropperImageSrc && (
            <ImageCropper
                imageSrc={cropperImageSrc}
                initialAvatarCrop={formData.avatarCrop}
                initialProfileCrop={formData.profileCrop}
                initialMode={cropperInitialMode}
                onSave={handleCropSave}
                onCancel={handleCropperCancel}
                onReupload={() => {
                    setIsCropperOpen(false);
                    setCropperImageSrc(null);
                    fileInputRef.current?.click();
                }}
            />
        )}

        <div className="absolute top-28 right-2 z-modal w-80 bg-white rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)] font-sans">
            <div className="overflow-y-auto flex-1">
                {/* Header with background and avatar */}
                <ArtistFormHeader
                    name={formData.name || ''}
                    avatarUrl={avatarUrl}
                    profileUrl={profileUrl}
                    isUploading={isUploadingImage}
                    onAvatarClick={handleAvatarClick}
                    onProfileClick={handleProfileClick}
                    onNameChange={updateName}
                />

                {/* Form content */}
                <div className="mt-10 px-4 pb-2 flex flex-col gap-4">
                    {/* Upload error */}
                    {uploadError && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            {uploadError}
                        </div>
                    )}

                    {/* Location inputs */}
                    <div className="space-y-4">
                        <LocationSearch
                            displayValue={getLocationDisplayValue(formData.originalLocation)}
                            onChange={(result) => handleLocationSelect(result, 'originalLocation')}
                            onManualPin={() => handleManualPin('originalLocation')}
                            placeholder="Search original location"
                            label="Original location"
                            pendingCoordinates={getPendingCoordinatesFor('originalLocation')}
                            onCoordinatesConsumed={handleCoordinatesConsumed}
                        />

                        <div className="flex justify-center -my-2 relative z-10">
                            <button
                                onClick={copyOriginalToActive}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-1.5 rounded-full transition-colors border border-gray-200 cursor-pointer"
                                title="Copy Original to Active"
                                type="button"
                            >
                                <ArrowDownIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <LocationSearch
                            displayValue={getLocationDisplayValue(formData.activeLocation)}
                            onChange={(result) => handleLocationSelect(result, 'activeLocation')}
                            onManualPin={() => handleManualPin('activeLocation')}
                            placeholder="Search active location"
                            label="Active location"
                            pendingCoordinates={getPendingCoordinatesFor('activeLocation')}
                            onCoordinatesConsumed={handleCoordinatesConsumed}
                        />
                    </div>

                    {/* Social Media section */}
                    <div className="border-t border-gray-100 pt-0 mt-0">
                        <button
                            onClick={() => setIsSocialExpanded(!isSocialExpanded)}
                            className="flex items-center justify-between w-[calc(100%+2rem)] py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-none px-4 -mx-4 transition-colors"
                            type="button"
                        >
                            <span className="font-semibold text-gray-700">Social Media</span>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isSocialExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isSocialExpanded && (
                            <div className="mt-2 flex flex-col gap-3 px-0 animate-in slide-in-from-top-2 duration-200">
                                {SOCIAL_FIELDS.map((field) => (
                                    <SocialLinkInput
                                        key={field.key}
                                        field={field}
                                        value={formData.socialLinks?.[field.key] || ''}
                                        onChange={updateSocialLink}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer with error and buttons */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
                {error && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {error}
                    </div>
                )}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-hover focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
        </>
    );
};

export default ArtistForm;
