import type { LocationView } from '../../../types/artist';

const ViewToggleButton = ({ view, setView }: { view: LocationView; setView: (view: LocationView) => void }) => {
    return (
        <div className="flex items-center bg-surface rounded-lg overflow-hidden shadow-md">
            <button
                onClick={() => setView('original')}
                className={`px-4 py-2 text-sm font-medium ${
                    view === 'original'
                        ? 'bg-primary text-white rounded-lg'
                        : 'text-text hover:bg-surface-muted'
                }`}
            >
                original
            </button>
            <button
                onClick={() => setView('active')}
                className={`px-4 py-2 text-sm font-medium ${
                    view === 'active'
                        ? 'bg-primary text-white rounded-lg'
                        : 'text-text hover:bg-surface-muted'
                }`}
            >
                active
            </button>
        </div>
    );
}

export default ViewToggleButton;