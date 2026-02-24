import { useState, useRef } from 'react';
import { ChevronDownIcon, ArrowDownIcon } from './Icons/FormIcons';
import { HomeIcon, MusicIcon, YoutubeIcon, InstagramIcon, XIcon } from './Icons/SocialIcons';
import { LocationSearch } from './LocationSearch';
import SocialLinkInput, { type SocialLinkField } from './SocialLinkInput';
import ImageCropper, { type CropResult } from './ImageCropper';
import ArtistFormHeader from './ArtistFormHeader';
import YearSelect from './YearSelect';
import { useArtistForm } from '../hooks/useArtistForm';
import { getAvatarUrl, getProfileUrl } from '../utils/cloudinaryUrl';
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
    { key: 'appleMusic', icon: MusicIcon, placeholder: 'Music URL' },
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
    const [showInactive, setShowInactive] = useState(() => !!initialData?.inactiveYear);
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
        updateDebutYear,
        updateInactiveYear,
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

        <div className="absolute top-28 right-2 z-[1050] w-80 bg-surface rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)] font-sans">
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
                <div className="mt-10 px-4 flex flex-col gap-4">
                    {/* Upload error */}
                    {uploadError && (
                        <div className="p-2 bg-error/10 border border-error/30 rounded text-sm text-error">
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
                                className="bg-surface-muted hover:bg-border text-text-secondary p-1.5 rounded-full transition-colors border border-border cursor-pointer"
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

                    {/* Career years */}
                    <div>
                        <label className="block text-sm font-bold text-text mb-1">
                            Career Years
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 flex gap-2">
                                <div className="flex-1">
                                    <YearSelect
                                        value={formData.debutYear}
                                        onChange={updateDebutYear}
                                        placeholder="Debut"
                                    />
                                </div>
                                <div className="flex-1">
                                    {showInactive ? (
                                        <YearSelect
                                            value={formData.inactiveYear}
                                            onChange={updateInactiveYear}
                                            placeholder="Inactive"
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center">
                                            <span className="px-3 py-1 text-sm font-medium text-text-secondary bg-surface-muted rounded-full">Present</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const newValue = !showInactive;
                                    setShowInactive(newValue);
                                    if (!newValue) updateInactiveYear(undefined);
                                }}
                                className="p-2 text-text-muted hover:text-primary transition-colors"
                                title={showInactive ? 'Artist is inactive' : 'Mark as inactive'}
                            >
                                {showInactive ? (
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {/* Double note icon */}
                                        <path d="M8 20V4l13-3v16" />
                                        <circle cx="4.5" cy="20" r="3.5" />
                                        <circle cx="17.5" cy="17" r="3.5" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {/* Zzz icon */}
                                        <path d="M4 4h8l-8 8h8" />
                                        <path d="M14 12h6l-6 6h6" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Social Media section */}
                    <div>
                        <button
                            onClick={() => setIsSocialExpanded(!isSocialExpanded)}
                            className={`flex items-center justify-between w-full px-3 py-2 text-sm font-bold text-text bg-surface-secondary hover:bg-surface-muted rounded-md transition-colors ${isSocialExpanded ? 'rounded-b-none' : ''}`}
                            type="button"
                        >
                            <span>Social Media</span>
                            <ChevronDownIcon className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isSocialExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isSocialExpanded && (
                            <div className="px-3 py-3 flex flex-col gap-3 bg-surface-secondary rounded-b-md">
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
            <div className="p-4 border-border bg-surface">
                {error && (
                    <div className="mb-3 p-2 bg-error/10 border border-error/30 rounded text-sm text-error">
                        {error}
                    </div>
                )}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 text-sm font-medium text-text bg-surface border border-border-strong rounded-md hover:bg-surface-secondary focus:outline-none focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
