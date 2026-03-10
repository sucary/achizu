import type { ArtistSearchResult, LocationSearchResult, UserSearchResult, SearchResult } from '../../types/search';
import { getAvatarUrl } from '../../utils/cloudinaryUrl';
import { formatLocation } from '../../utils/locationUtils';
import { UserIcon } from '../icons/GeneralIcons';
import { useAuth } from '../../context/AuthContext';

interface SearchResultRowProps {
    result: SearchResult;
    onSelect: () => void;
}

const getPlaceholderUrl = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=150&background=e5e7eb&color=9ca3af`;

function ArtistRow({ result, onSelect }: { result: ArtistSearchResult; onSelect: () => void }) {
    const avatarUrl = getAvatarUrl(result.sourceImage, result.avatarCrop) || getPlaceholderUrl(result.name);

    return (
        <div
            onClick={onSelect}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors cursor-pointer"
        >
            <img
                src={avatarUrl}
                alt={result.name}
                className="w-10 h-10 rounded-full object-cover border border-border"
            />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{result.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                    <span className="px-[3.5px] py-[1.5px] text-[10px] font-bold bg-primary-light text-white border border-primary-light rounded-[3.5px]">
                        Active
                    </span>
                    <span className="text-xs text-text-secondary truncate">
                        {formatLocation(result.activeLocation)}
                    </span>
                </div>
            </div>
        </div>
    );
}

function LocationRow({ result, onSelect }: { result: LocationSearchResult; onSelect: () => void }) {
    const { profile } = useAuth();
    return (
        <div
            onClick={onSelect}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors cursor-pointer"
        >
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{result.displayName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    {result.locationType && (
                        <span className="text-xs text-text-secondary capitalize">{result.locationType}</span>
                    )}
                    {profile?.isAdmin && result.isLocal && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-secondary/10 text-secondary ml-auto">
                            DB
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function UserRow({ result, onSelect }: { result: UserSearchResult; onSelect: () => void }) {
    return (
        <div
            onClick={onSelect}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors cursor-pointer"
        >
            <div className="w-8 h-10 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{result.username}</p>
                <span className="text-xs text-text-secondary">View map</span>
            </div>
        </div>
    );
}

export function SearchResultRow({ result, onSelect }: SearchResultRowProps) {
    switch (result.type) {
        case 'artist':
            return <ArtistRow result={result} onSelect={onSelect} />;
        case 'location':
            return <LocationRow result={result} onSelect={onSelect} />;
        case 'user':
            return <UserRow result={result} onSelect={onSelect} />;
    }
}
