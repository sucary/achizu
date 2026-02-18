import { useMap } from 'react-leaflet';
import type { LocationView } from '../../../types/artist';

interface MapControlsProps {
    view: LocationView;
    setView: (view: LocationView) => void;
}

const MapControls = ({ view, setView }: MapControlsProps) => {
    const map = useMap();

    const handleZoomIn = () => map.zoomIn();
    const handleZoomOut = () => map.zoomOut();
    const handleLocate = () => map.locate({ setView: true, maxZoom: 15 });

    const buttonClass = "bg-white w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-700";

    return (
        <div className="absolute bottom-6 right-2 z-[1000] flex flex-col gap-2 items-end">
            {/* Locate */}
            <button
                onClick={handleLocate}
                className={`${buttonClass} rounded-md shadow-md`}
                title="Locate Me"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>

            {/* Zoom */}
            <div className="flex flex-col rounded-md shadow-md overflow-hidden">
                <button
                    onClick={handleZoomIn}
                    className={`${buttonClass} border-b border-gray-200`}
                    title="Zoom In"
                >
                    <span className="text-lg font-medium">+</span>
                </button>
                <button
                    onClick={handleZoomOut}
                    className={buttonClass}
                    title="Zoom Out"
                >
                    <span className="text-lg font-medium">−</span>
                </button>
            </div>

            {/* View Toggle */}
            <div className="flex bg-white rounded-md overflow-hidden shadow-md">
                <button
                    onClick={() => setView('original')}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                        view === 'original'
                            ? 'bg-primary text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                    Origin
                </button>
                <button
                    onClick={() => setView('active')}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                        view === 'active'
                            ? 'bg-primary text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                    Active
                </button>
            </div>
        </div>
    );
};

export default MapControls;
