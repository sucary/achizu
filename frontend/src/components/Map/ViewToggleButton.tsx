import type { LocationView } from '../../types/artist';

const ViewToggleButton = ({ view, setView }: { view: LocationView ; setView: (view: LocationView) => void }) => {
    const toggleView = () => {
        const newView = view === 'active' ? 'original' : 'active';
        setView(newView);
    };

    const displayName = view === 'active' ? 'Showing Active Locations' : 'Showing Original Locations';
    return (
        <div className="absolute top-14 right-2 z-[1000]">
            <button
                onClick={toggleView}
                className="bg-white px-4 py-2 rounded-full shadow-xl hover:bg-gray-100 transition-colors"
                title="Toggle Location View"
            >
                {displayName}
            </button>
        </div>
    );
}

export default ViewToggleButton;