import { useState } from 'react';
import { ChevronDownIcon, ArrowDownIcon, EditIcon } from './Icons/FormIcons';
import { HomeIcon, MusicIcon, YoutubeIcon, InstagramIcon, XIcon } from './Icons/SocialIcons';
import { LocationSearch } from './LocationSearch';
import SocialLinkInput, { type SocialLinkField } from './SocialLinkInput';
import { useArtistForm, useMapSelectionHandler } from '../hooks/useArtistForm';
import type { SearchResult } from '../services/api';
import type { Artist } from '../types/artist';

interface ArtistFormProps {
    initialData?: Artist;
    onSubmit?: (data: Partial<Artist>) => void;
    onCancel?: () => void;
    onRequestSelection?: (targetField: 'originalLocation' | 'activeLocation') => void;
    pendingLocationResult?: SearchResult | null;
    onConsumePendingResult?: () => void;
}

const SOCIAL_FIELDS: SocialLinkField[] = [
    { key: 'website', icon: HomeIcon, placeholder: 'Website URL' },
    { key: 'instagram', icon: InstagramIcon, placeholder: 'Instagram URL' },
    { key: 'twitter', icon: XIcon, placeholder: 'Twitter/X URL' },
    { key: 'appleMusic', icon: MusicIcon, placeholder: 'Apple Music URL' },
    { key: 'youtube', icon: YoutubeIcon, placeholder: 'YouTube URL' },
];

const MAX_NAME_LENGTH = 22;

const ArtistForm = ({
    initialData,
    onSubmit,
    onCancel,
    onRequestSelection,
    pendingLocationResult,
    onConsumePendingResult
}: ArtistFormProps) => {
    const [isSocialExpanded, setIsSocialExpanded] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);

    const {
        formData,
        isSaving,
        error,
        pendingField,
        handleLocationSelect,
        handleSave,
        copyOriginalToActive,
        startManualPinSelection,
        clearPendingField,
        updateSocialLink,
        updateName,
    } = useArtistForm({
        initialData,
        onSuccess: onSubmit,
        onCancel
    });

    // Handle map selection coordination with proper dependencies
    useMapSelectionHandler(
        pendingField,
        pendingLocationResult,
        handleLocationSelect,
        clearPendingField,
        onConsumePendingResult
    );

    const handleManualPin = (locationType: 'originalLocation' | 'activeLocation') => {
        startManualPinSelection(locationType);
        onRequestSelection?.(locationType);
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

    const displayName = formData.name && formData.name.length > MAX_NAME_LENGTH
        ? `${formData.name.substring(0, MAX_NAME_LENGTH)}...`
        : formData.name;

    return (
        <div className="absolute top-28 right-4 z-[1000] w-80 bg-white rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)] font-sans">
            <div className="overflow-y-auto flex-1">
                {/* Header with background and avatar */}
                <div
                    className="relative w-full h-32 bg-gray-200 bg-cover bg-center"
                    style={{ backgroundImage: formData.profilePicture ? `url(${formData.profilePicture})` : undefined }}
                >
                    <div className="absolute inset-0 bg-black/10 hover:bg-black/20 transition-colors" />

                    {/* Avatar */}
                    <div className="absolute -bottom-8 left-4 w-20 h-20 rounded-full border-4 border-white bg-gray-300 overflow-hidden z-10 shadow-md group/avatar cursor-pointer">
                        <img
                            src={formData.profilePicture || 'https://via.placeholder.com/150'}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                            <EditIcon className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    {/* Name */}
                    <div className="absolute bottom-2 left-28 right-4 z-10">
                        {isEditingName ? (
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => updateName(e.target.value)}
                                onBlur={() => setIsEditingName(false)}
                                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                                className="w-full bg-transparent border-b-2 border-white/80 text-lg font-bold text-white outline-none placeholder-white/50 drop-shadow-md p-0 m-0 leading-tight"
                                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                                autoFocus
                                maxLength={MAX_NAME_LENGTH}
                            />
                        ) : (
                            <h2
                                onClick={() => setIsEditingName(true)}
                                className="text-lg font-bold text-white drop-shadow-md hover:text-gray-100 whitespace-nowrap overflow-hidden p-0 m-0 leading-tight border-b-2 border-transparent cursor-pointer"
                                title={formData.name}
                                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                            >
                                {displayName}
                            </h2>
                        )}
                    </div>
                </div>

                {/* Form content */}
                <div className="mt-10 px-4 flex flex-col gap-4">
                    {/* Location inputs */}
                    <div className="space-y-4">
                        <LocationSearch
                            displayValue={getLocationDisplayValue(formData.originalLocation)}
                            onChange={(result) => handleLocationSelect(result, 'originalLocation')}
                            onManualPin={() => handleManualPin('originalLocation')}
                            placeholder="Search original location"
                            label="Original location"
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
                        />
                    </div>

                    {/* Social Media section */}
                    <div className="border-t border-gray-100 pt-0 mt-0">
                        <button
                            onClick={() => setIsSocialExpanded(!isSocialExpanded)}
                            className="flex items-center justify-between w-full py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-none px-4 -mx-4 transition-colors"
                            style={{ width: 'calc(100% + 2rem)' }}
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
                                        value={formData.socialLinks?.[field.key as keyof typeof formData.socialLinks] || ''}
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
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-[#FA2D48] disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FA2D48] border border-transparent rounded-md hover:bg-[#E11D38] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ArtistForm;
