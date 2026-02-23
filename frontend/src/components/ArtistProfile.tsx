import type { Artist, Location } from '../types/artist';
import { HomeIcon, MusicIcon, YoutubeIcon, InstagramIcon, XIcon } from './Icons/SocialIcons';
import { EditIcon, TrashIcon } from './Icons/FormIcons';
import { getProfileUrl } from '../utils/cloudinaryUrl';

interface ArtistProfileProps {
    artist: Artist;
}

const formatLocation = (location: Location): string => {
    const parts = [location.city, location.province];
    if (location.country) {
        parts.push(location.country);
    }
    return parts.join(', ');
};

// URL sanitizer
const safeUrl = (url: string): string => {
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return url;
    }
    // Auto-prepend https:// for lazy users
    if (trimmed.includes('.') && !trimmed.includes(':')) {
        return `https://${url.trim()}`;
    }
    return '#';
};

// Placeholder for artists without profile picture
const getPlaceholderUrl = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=320&background=e5e7eb&color=9ca3af`;

const ArtistProfile = ({ artist }: ArtistProfileProps) => {
    // Use Cloudinary transformation for profile banner
    const backgroundImageUrl = getProfileUrl(artist.sourceImage, artist.profileCrop) || getPlaceholderUrl(artist.name);
    
    return (
        <div className="w-80 flex flex-col rounded-lg bg-white shadow-lg overflow-hidden">
            <style>{`
                .artist-cover:hover .artist-action-bar {
                    opacity: 1 !important;
                }
                .artist-action-edit:hover {
                    background-color: rgba(0, 0, 0, 0.65) !important;
                }
                .artist-action-delete:hover {
                    background-color: rgba(220, 38, 38, 0.95) !important;
                }
            `}</style>
            {/* Header with cover image */}
            <div
                className="artist-cover relative w-full h-28 bg-gray-200 bg-cover bg-center"
                style={{ backgroundImage: `url(${backgroundImageUrl})` }}
            >
                {/* Action bar - shows on hover */}
                <div
                    className="artist-action-bar absolute inset-0 flex"
                    style={{ opacity: 0, transition: 'opacity 0.2s ease-in-out' }}
                >
                    {/* Edit */}
                    <div
                        className="artist-action-edit flex items-center justify-center cursor-pointer"
                        style={{ width: '80%', backgroundColor: 'rgba(0, 0, 0, 0.5)', transition: 'background-color 0.15s' }}
                        data-action="edit"
                        data-artist-id={artist.id}
                    >
                        <EditIcon className="w-6 h-6 text-white" />
                    </div>
                    {/* Delete */}
                    <div
                        className="artist-action-delete flex items-center justify-center cursor-pointer"
                        style={{ width: '20%', backgroundColor: 'rgba(239, 68, 68, 0.85)', transition: 'background-color 0.15s' }}
                        data-action="delete"
                        data-artist-id={artist.id}
                    >
                        <TrashIcon className="w-5 h-5 text-white" />
                    </div>
                </div>

                {/* Artist Name */}
                <h3
                    className="absolute bottom-3 left-4 text-lg font-semibold text-white z-10 select-text cursor-text"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
                >
                    {artist.name}
                </h3>
            </div>

            {/* Content section */}
            <div className="px-4 py-3 flex flex-col gap-2.5">
                {/* Origin row */}
                <div className="flex items-center gap-4">
                    <span className="px-2 py-0.5 text-xs font-medium text-[#E53935] border border-[#E53935] rounded">
                        Origin
                    </span>
                    <span className="text-sm text-gray-600">
                        {formatLocation(artist.originalLocation)}
                    </span>
                </div>

                {/* Active row */}
                <div className="flex items-center gap-4">
                    <span className="px-2 py-0.5 text-xs font-medium text-[#E53935] border border-[#E53935] rounded">
                        Active
                    </span>
                    <span className="text-sm text-gray-600">
                        {formatLocation(artist.activeLocation)}
                    </span>
                </div>

                {/* Divider */}
                <div className="h-px w-full bg-gray-200 my-1" />

                {/* Footer row */}
                <div className="flex items-center justify-between min-h-6">
                    {/* Year */}
                    {artist.debutYear && (
                        <div className="flex items-center gap-0.5 text-sm text-gray-500 font-sans">
                            <span className="font-medium">{artist.debutYear}</span>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <span className="px-3 py-1 text-sm font-medium text-gray-500 bg-gray-100 rounded-full">
                                {artist.inactiveYear || 'Present'}
                            </span>
                        </div>
                    )}
                    {/* Social icons */}
                    <div className="flex gap-3">
                        {artist.socialLinks?.website && (
                            <a href={safeUrl(artist.socialLinks.website)} target="_blank" rel="noopener noreferrer" className="!text-gray-400 hover:!text-[#FA233B] visited:!text-gray-400 transition-colors">
                                <HomeIcon className="w-5 h-5" />
                            </a>
                        )}
                        {artist.socialLinks?.appleMusic && (
                            <a href={safeUrl(artist.socialLinks.appleMusic)} target="_blank" rel="noopener noreferrer" className="!text-gray-400 hover:!text-[#FA233B] visited:!text-gray-400 transition-colors">
                                <MusicIcon className="w-5 h-5" />
                            </a>
                        )}
                        {artist.socialLinks?.youtube && (
                            <a href={safeUrl(artist.socialLinks.youtube)} target="_blank" rel="noopener noreferrer" className="!text-gray-400 hover:!text-[#FA233B] visited:!text-gray-400 transition-colors">
                                <YoutubeIcon className="w-5 h-5" />
                            </a>
                        )}
                        {artist.socialLinks?.instagram && (
                            <a href={safeUrl(artist.socialLinks.instagram)} target="_blank" rel="noopener noreferrer" className="!text-gray-400 hover:!text-[#FA233B] visited:!text-gray-400 transition-colors">
                                <InstagramIcon className="w-5 h-5" />
                            </a>
                        )}
                        {artist.socialLinks?.twitter && (
                            <a href={safeUrl(artist.socialLinks.twitter)} target="_blank" rel="noopener noreferrer" className="!text-gray-400 hover:!text-[#FA233B] visited:!text-gray-400 transition-colors">
                                <XIcon className="w-5 h-5" />
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArtistProfile;
