import { useNavigate } from 'react-router-dom';

interface ViewingUserBannerProps {
    username: string;
}

export function ViewingUserBanner({ username }: ViewingUserBannerProps) {
    const navigate = useNavigate();

    return (
        <div className="flex items-center h-10 bg-surface border border-border rounded-lg shadow-md font-sans">
            <span className="text-sm text-text px-4">
                Viewing <span className="font-semibold text-primary">{username}</span>'s map
            </span>
            <div className="w-px h-6 bg-border" />
            <button
                onClick={() => navigate('/')}
                className="px-3 h-full text-text-secondary hover:bg-primary hover:text-white transition-colors rounded-r-lg"
                title="Back to my map"
            >
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            </button>
        </div>
    );
}
