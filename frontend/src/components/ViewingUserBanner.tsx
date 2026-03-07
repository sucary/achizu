import { useNavigate } from 'react-router-dom';
import { IconButton } from './ui';

interface ViewingUserBannerProps {
    username: string;
}

export function ViewingUserBanner({ username }: ViewingUserBannerProps) {
    const navigate = useNavigate();

    return (
        <div className="flex items-center gap-2 pl-4 pr-2 py-1.5 bg-surface border border-border rounded-full shadow-md">
            <span className="text-sm text-text">
                Viewing <span className="font-semibold text-primary">{username}</span>'s map
            </span>
            <IconButton
                onClick={() => navigate('/')}
                size="sm"
                className="hover:bg-surface-muted"
                title="Back to my map"
            >
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            </IconButton>
        </div>
    );
}
