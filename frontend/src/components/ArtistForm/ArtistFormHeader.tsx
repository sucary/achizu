import { useState, useRef } from 'react';
import { EditIcon } from '../icons/GeneralIcons';
import { MAX_NAME_LENGTH } from '../../constants/artist';

type HoverTarget = 'name' | 'avatar' | null;

interface ArtistFormHeaderProps {
    name: string;
    avatarUrl?: string;
    profileUrl?: string;
    isUploading: boolean;
    onAvatarClick: () => void;
    onProfileClick: () => void;
    onNameChange: (name: string) => void;
}

const ArtistFormHeader = ({
    name,
    avatarUrl,
    profileUrl,
    isUploading,
    onAvatarClick,
    onProfileClick,
    onNameChange,
}: ArtistFormHeaderProps) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null);
    const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

    const displayName = name.length > MAX_NAME_LENGTH
        ? `${name.substring(0, MAX_NAME_LENGTH)}...`
        : name;

    const placeholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'New Artist')}&size=150&background=e5e7eb&color=9ca3af`;

    const handleProfileClick = (e: React.MouseEvent) => {
        if (mouseDownPos.current) {
            const dx = e.clientX - mouseDownPos.current.x;
            const dy = e.clientY - mouseDownPos.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If mouse moved more than 5 pixels, it's a drag, not a click
            // Prevents accidental clicks when trying to drag the name
            if (distance > 5) {
                mouseDownPos.current = null;
                return;
            }
        }
        onProfileClick();
        mouseDownPos.current = null;
    };

    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (mouseDownPos.current) {
            const dx = e.clientX - mouseDownPos.current.x;
            const dy = e.clientY - mouseDownPos.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                mouseDownPos.current = null;
                return;
            }
        }
        onAvatarClick();
        mouseDownPos.current = null;
    };

    return (
        <div
            className="relative w-full h-32 bg-surface-muted bg-cover bg-center group/profile cursor-pointer"
            style={{ backgroundImage: profileUrl ? `url(${profileUrl})` : undefined }}
            onMouseDown={(e) => mouseDownPos.current = { x: e.clientX, y: e.clientY }}
            onClick={handleProfileClick}
        >
            {/* Hover overlay */}
            <div className={`absolute inset-0 bg-black/10 transition-colors flex items-center justify-center ${!hoverTarget ? 'group-hover/profile:bg-black/30' : ''}`}>
                <EditIcon className={`w-6 h-6 text-white transition-opacity ${!hoverTarget ? 'opacity-0 group-hover/profile:opacity-100' : 'opacity-0'}`} />
            </div>

            {/* Avatar */}
            <div
                className="absolute -bottom-8 left-4 w-20 h-20 rounded-full border-4 border-surface bg-border overflow-hidden z-10 shadow-md group/avatar cursor-pointer"
                onMouseDown={(e) => mouseDownPos.current = { x: e.clientX, y: e.clientY }}
                onClick={handleAvatarClick}
                onMouseEnter={() => setHoverTarget('avatar')}
                onMouseLeave={() => setHoverTarget(null)}
            >
                {isUploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-border-strong">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-surface"></div>
                    </div>
                ) : (
                    <>
                        <img
                            src={avatarUrl || placeholderUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                            <EditIcon className="w-6 h-6 text-white" />
                        </div>
                    </>
                )}
            </div>

            {/* Name */}
            <div
                className="absolute bottom-2 left-28 right-4 z-10"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => setHoverTarget('name')}
                onMouseLeave={() => setHoverTarget(null)}
            >
                {isEditingName ? (
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        onBlur={() => setIsEditingName(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                        className="w-full bg-transparent border-b-2 border-surface/80 text-lg font-bold text-white outline-none placeholder-white/50 text-shadow-overlay p-0 m-0 leading-tight"
                        autoFocus
                        maxLength={MAX_NAME_LENGTH}
                    />
                ) : (
                    <h2
                        onClick={() => setIsEditingName(true)}
                        className="text-lg font-bold text-white text-shadow-overlay hover:text-gray-100 whitespace-nowrap overflow-hidden p-0 m-0 leading-tight border-b-2 border-transparent cursor-pointer min-h-[1.75rem]"
                        title={name}
                    >
                        {displayName}
                    </h2>
                )}
            </div>
        </div>
    );
};

export default ArtistFormHeader;
