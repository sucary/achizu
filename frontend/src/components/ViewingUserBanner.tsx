import { useNavigate } from 'react-router-dom';
import { Banner, HomeIcon } from './Banner';

interface ViewingUserBannerProps {
    username: string;
}

export function ViewingUserBanner({ username }: ViewingUserBannerProps) {
    const navigate = useNavigate();

    return (
        <Banner
            content={<>Viewing <span className="font-semibold text-primary">{username}</span>'s map</>}
            action={{ type: 'icon', icon: <HomeIcon />, onClick: () => navigate('/'), title: 'Back to my map' }}
        />
    );
}
