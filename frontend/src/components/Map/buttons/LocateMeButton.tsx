import { useMap } from 'react-leaflet';

// The locate-me button

const LocateMeButton = () => {
    const map = useMap();

    const handleLocate = () => {
        map.locate({ setView: true, maxZoom: 15});
    };
    
    return (
        <div className="absolute bottom-[130px] right-[10px] z-[1000]">
            <button
                onClick={handleLocate}
                className="bg-surface w-10 h-10 flex items-center justify-center rounded-md shadow-md hover:bg-surface-muted transition-colors text-text"
                title="Locate Me"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
        </div>
    );
}

export default LocateMeButton;