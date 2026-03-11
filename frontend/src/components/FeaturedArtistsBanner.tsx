import { Banner, HomeIcon } from './Banner';

interface FeaturedArtistsBannerProps {
    artistCount: number;
    onHomeClick: () => void;
}

export function FeaturedArtistsBanner({ artistCount, onHomeClick }: FeaturedArtistsBannerProps) {
    return (
        <Banner
            content={<><span className="font-semibold text-primary">{artistCount}</span> featured artists</>}
            action={{ type: 'icon', icon: <HomeIcon />, onClick: onHomeClick, title: 'Back to my map' }}
        />
    );
}
