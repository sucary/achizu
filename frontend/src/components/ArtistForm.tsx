import { useState } from 'react';
import { ChevronDownIcon, ArrowDownIcon, EditIcon } from './Icons/FormIcons';
import { HomeIcon, MusicIcon, YoutubeIcon, InstagramIcon, XIcon } from './Icons/SocialIcons';
import { LocationSearch } from './LocationSearch';
import type { SearchResult } from '../services/api';
import type { Artist } from '../types/artist';

interface ArtistFormProps {
    initialData?: Artist;
    onSubmit?: (data: Partial<Artist>) => void;
    onCancel?: () => void;
}

const ArtistForm = ({ initialData, onCancel }: ArtistFormProps) => {
    const [isSocialExpanded, setIsSocialExpanded] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    
    const [formData, setFormData] = useState<Partial<Artist>>(initialData || {
        name: 'New Artist',
        profilePicture: '',
        originalLocation: { city: '', province: '', coordinates: { lat: 0, lng: 0 } },
        activeLocation: { city: '', province: '', coordinates: { lat: 0, lng: 0 } },
        socialLinks: {}
    });

    const copyOriginalToActive = () => {
        setFormData(prev => ({
            ...prev,
            activeLocation: prev.originalLocation
        }));
    };

    const handleOriginalLocationSelect = (result: SearchResult) => {
        setFormData(prev => ({
            ...prev,
            originalLocation: {
                city: result.name,
                province: result.province,
                country: result.country,
                coordinates: result.center,
                displayName: result.displayName,
                osmId: result.osmId,
                osmType: result.osmType
            }
        }));
    };

    const handleActiveLocationSelect = (result: SearchResult) => {
        setFormData(prev => ({
            ...prev,
            activeLocation: {
                city: result.name,
                province: result.province,
                country: result.country,
                coordinates: result.center,
                displayName: result.displayName,
                osmId: result.osmId,
                osmType: result.osmType
            }
        }));
    };

    const getIconColor = (value?: string) => {
        return value ? "text-[#FA2D48]" : "text-gray-400";
    };

    return (
        <div className="absolute top-28 right-4 z-[1000] w-80 bg-white rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)] font-sans">
            <div className="overflow-y-auto flex-1">
                {/* Header */}
                <div className="relative w-full h-32 bg-gray-200 bg-cover bg-center"
                     style={{ backgroundImage: formData.profilePicture ? `url(${formData.profilePicture})` : undefined }}
                >
                    <div className="absolute inset-0 bg-black/10 hover:bg-black/20 transition-colors" />
                    
                    {/* Avatar */}
                    <div className="absolute -bottom-8 left-4 w-20 h-20 rounded-full border-4 border-white bg-gray-300 overflow-hidden z-10 shadow-md group/avatar cursor-pointer"
                    >
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
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                onBlur={() => setIsEditingName(false)}
                                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                                className="w-full bg-transparent border-b-2 border-white/80 text-lg font-bold text-white outline-none placeholder-white/50 drop-shadow-md p-0 m-0 leading-tight"
                                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                                autoFocus
                                maxLength={22}
                            />
                        ) : (
                            <h2
                                onClick={() => setIsEditingName(true)}
                                className="text-lg font-bold text-white drop-shadow-md hover:text-gray-100 whitespace-nowrap overflow-hidden p-0 m-0 leading-tight border-b-2 border-transparent cursor-pointer"
                                title={formData.name}
                                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                            >
                                {formData.name && formData.name.length > 22 ? `${formData.name.substring(0, 22)}...` : formData.name}
                            </h2>
                        )}
                    </div>
                </div>

                {/* Spacing for avatar */}
                <div className="mt-10 px-4 flex flex-col gap-4">
                    
                    {/* Locations */}
                    <div className="space-y-4">
                        <LocationSearch
                            value={formData.originalLocation?.displayName || (formData.originalLocation?.city && formData.originalLocation?.country ? `${formData.originalLocation.city}, ${formData.originalLocation.country}` : '')}
                            onChange={handleOriginalLocationSelect}
                            onManualPin={() => {/* TODO: Enable map picking mode */}}
                            placeholder="Search original location"
                            label="ORIGINAL LOCATION"
                        />

                        <div className="flex justify-center -my-2 relative z-10">
                            <button
                                onClick={copyOriginalToActive}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-1.5 rounded-full transition-colors border border-gray-200 cursor-pointer"
                                title="Copy Original to Active"
                            >
                                <ArrowDownIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <LocationSearch
                            value={formData.activeLocation?.displayName || (formData.activeLocation?.city && formData.activeLocation?.country ? `${formData.activeLocation.city}, ${formData.activeLocation.country}` : '')}
                            onChange={handleActiveLocationSelect}
                            onManualPin={() => {/* TODO: Enable map picking mode */}}
                            placeholder="Search active location"
                            label="ACTIVE LOCATION"
                        />
                    </div>

                    {/* Social Media */}
                    <div className="border-t border-gray-100 pt-0 mt-0">
                        <button
                            onClick={() => setIsSocialExpanded(!isSocialExpanded)}
                            className="flex items-center justify-between w-full py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-none px-4 -mx-4 transition-colors"
                            style={{ width: 'calc(100% + 2rem)' }}
                        >
                            <span className='font-semibold text-gray-700'>Social Media</span>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isSocialExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isSocialExpanded && (
                            <div className="mt-2 flex flex-col gap-3 px-0 animate-in slide-in-from-top-2 duration-200">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Website URL"
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#FA2D48] focus:ring-1 focus:ring-inset focus:ring-[#FA2D48]"
                                        value={formData.socialLinks?.website || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, website: e.target.value}})}
                                    />
                                    <HomeIcon className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${getIconColor(formData.socialLinks?.website)}`} />
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Instagram URL"
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#FA2D48] focus:ring-1 focus:ring-inset focus:ring-[#FA2D48]"
                                        value={formData.socialLinks?.instagram || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, instagram: e.target.value}})}
                                    />
                                    <InstagramIcon className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${getIconColor(formData.socialLinks?.instagram)}`} />
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Twitter/X URL"
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#FA2D48] focus:ring-1 focus:ring-inset focus:ring-[#FA2D48]"
                                        value={formData.socialLinks?.twitter || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, twitter: e.target.value}})}
                                    />
                                    <XIcon className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${getIconColor(formData.socialLinks?.twitter)}`} />
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Apple Music URL"
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#FA2D48] focus:ring-1 focus:ring-inset focus:ring-[#FA2D48]"
                                        value={formData.socialLinks?.appleMusic || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, appleMusic: e.target.value}})}
                                    />
                                    <MusicIcon className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${getIconColor(formData.socialLinks?.appleMusic)}`} />
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="YouTube URL"
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#FA2D48] focus:ring-1 focus:ring-inset focus:ring-[#FA2D48]"
                                        value={formData.socialLinks?.youtube || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, youtube: e.target.value}})}
                                    />
                                    <YoutubeIcon className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${getIconColor(formData.socialLinks?.youtube)}`} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer*/}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button 
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-[#FA2D48]"
                >
                    Cancel
                </button>
                <button
                    className="flex-2 px-4 py-2 text-sm font-medium text-white bg-[#FA2D48] border border-transparent rounded-md hover:bg-[#E11D38] focus:outline-none"
                >
                    Save
                </button>
            </div>
        </div>
    );
};

export default ArtistForm;