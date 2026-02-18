import type { LocationView } from '../../../types/artist';

const ViewToggleButton = ({ view, setView }: { view: LocationView; setView: (view: LocationView) => void }) => {
    return (
        <div className="flex items-center bg-white rounded-lg overflow-hidden shadow-md">
            <button
                onClick={() => setView('original')}
                className={`px-4 py-2 text-sm font-medium ${
                    view === 'original'
                        ? 'bg-red-500 text-white rounded-lg'
                        : 'text-gray-800 hover:bg-gray-100'
                }`}
            >
                original
            </button>
            <button
                onClick={() => setView('active')}
                className={`px-4 py-2 text-sm font-medium ${
                    view === 'active'
                        ? 'bg-red-500 text-white rounded-lg'
                        : 'text-gray-800 hover:bg-gray-100'
                }`}
            >
                active
            </button>
        </div>
    );
}

export default ViewToggleButton;