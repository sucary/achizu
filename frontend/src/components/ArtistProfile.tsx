import type { Artist, Location } from '../types/artist';
import { HomeIcon, MusicIcon, YoutubeIcon, InstagramIcon, XIcon } from './Icons/SocialIcons';
import { EditIcon, TrashIcon } from './Icons/FormIcons';

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

const ArtistProfile = ({ artist }: ArtistProfileProps) => {
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
                style={{ backgroundImage: artist.profilePicture ? `url(${artist.profilePicture})` : undefined }}
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
                    className="absolute bottom-3 left-4 text-lg font-semibold text-white pointer-events-none"
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

                {/* Links row */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Links</span>
                    <div className="flex gap-1">
                        {artist.socialLinks?.website && (
                            <a href={artist.socialLinks.website} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#E53935] transition-colors">
                                <HomeIcon className="w-5 h-5" />
                            </a>
                        )}
                        {artist.socialLinks?.appleMusic && (
                            <a href={artist.socialLinks.appleMusic} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#E53935] transition-colors">
                                <MusicIcon className="w-5 h-5" />
                            </a>
                        )}
                        {artist.socialLinks?.youtube && (
                            <a href={artist.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#E53935] transition-colors">
                                <YoutubeIcon className="w-5 h-5" />
                            </a>
                        )}
                        {artist.socialLinks?.instagram && (
                            <a href={artist.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#E53935] transition-colors">
                                <InstagramIcon className="w-5 h-5" />
                            </a>
                        )}
                        {artist.socialLinks?.twitter && (
                            <a href={artist.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#E53935] transition-colors">
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
