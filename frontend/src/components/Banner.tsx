import type { ReactNode } from 'react';

type BannerAction =
    | { type: 'text'; label: string; onClick: () => void }
    | { type: 'icon'; icon: ReactNode; onClick: () => void; title: string };

interface BannerProps {
    content: ReactNode;
    action: BannerAction;
}

export function Banner({ content, action }: BannerProps) {
    return (
        <div className="flex items-center h-10 bg-surface border border-border rounded-lg shadow-md font-sans">
            <span className="text-sm text-text px-4">
                {content}
            </span>
            <div className="w-px h-6 bg-border" />
            {action.type === 'text' ? (
                <button
                    onClick={action.onClick}
                    className="px-3 h-full text-sm text-text hover:bg-surface-muted transition-colors rounded-r-lg font-medium"
                >
                    {action.label}
                </button>
            ) : (
                <button
                    onClick={action.onClick}
                    className="px-3 h-full text-text-secondary hover:bg-surface-muted hover:text-text transition-colors rounded-r-lg"
                    title={action.title}
                >
                    {action.icon}
                </button>
            )}
        </div>
    );
}

export const HomeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);
