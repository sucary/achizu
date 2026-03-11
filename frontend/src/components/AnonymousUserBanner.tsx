import { useQuery } from '@tanstack/react-query';
import { getArtists } from '../services/api';
import { Banner } from './Banner';

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
        <Banner
            content={<><span className="font-semibold text-primary">{artistCount}</span> featured artists</>}
            action={{ type: 'text', label: 'Sign In', onClick: onSignInClick }}
        />
    );
}
