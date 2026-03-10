import { useQuery } from '@tanstack/react-query';
import { getArtists } from '../services/api';

interface AnonymousUserBannerProps {
    onSignInClick: () => void;
}

export function AnonymousUserBanner({ onSignInClick }: AnonymousUserBannerProps) {
    const { data: artists } = useQuery({
        queryKey: ['artists'],
        queryFn: () => getArtists(),
    });

    const artistCount = artists?.length || 0;

    return (
        <div className="flex items-center h-10 bg-surface border border-border rounded-lg shadow-md font-sans">
            <span className="text-sm text-text px-4">
                <span className="font-semibold text-primary">{artistCount}</span> featured artists
            </span>
            <div className="w-px h-6 bg-border" />
            <button
                onClick={onSignInClick}
                className="px-3 h-full text-sm text-text hover:bg-surface-muted transition-colors rounded-r-lg font-medium"
            >
                Sign In
            </button>
        </div>
    );
}
