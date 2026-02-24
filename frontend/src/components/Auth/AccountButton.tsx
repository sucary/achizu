import { useAuth } from '../../context/AuthContext';
import { AuthModal } from './AuthModal';
import { UserMenu } from './UserMenu';

interface AccountButtonProps {
    showAuthModal: boolean;
    onOpenAuthModal: () => void;
    onCloseAuthModal: () => void;
    onOpenAdminDashboard?: () => void;
}

export function AccountButton({ showAuthModal, onOpenAuthModal, onCloseAuthModal, onOpenAdminDashboard }: AccountButtonProps) {
    const { user, loading } = useAuth();

    if (loading) {
        return null;
    }

    return (
        <>
            {user ? (
                <UserMenu onOpenAdminDashboard={onOpenAdminDashboard} />
            ) : (
                <button
                    onClick={onOpenAuthModal}
                    className="px-4 py-2 bg-surface rounded-lg shadow-md hover:shadow-lg transition-shadow text-sm font-medium text-text"
                >
                    Sign In
                </button>
            )}
            <AuthModal isOpen={showAuthModal} onClose={onCloseAuthModal} />
        </>
    );
}
