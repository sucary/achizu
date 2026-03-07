import { useMap } from 'react-leaflet';
import { LocationIcon } from '../../icons/FormIcons';
import type { LocationView } from '../../../types/artist';
import type { TileLayerType } from '../MapView';

type DisplayMode = 'cluster' | 'progressive';

interface MapControlsProps {
    view: LocationView;
    setView: (view: LocationView) => void;
    displayMode: DisplayMode;
    setDisplayMode: (mode: DisplayMode) => void;
    tileLayer: TileLayerType;
    setTileLayer: (layer: TileLayerType) => void;
}

const MapControls = ({ view, setView, displayMode, setDisplayMode, tileLayer, setTileLayer }: MapControlsProps) => {
    const map = useMap();

    const handleZoomIn = () => map.zoomIn();
    const handleZoomOut = () => map.zoomOut();
    const handleLocate = () => map.locate({ setView: true, maxZoom: 15 });

    const mapButtonClass = "bg-surface w-10 h-10 flex items-center justify-center hover:bg-surface-muted transition-colors text-text";

    return (
        <div className="absolute bottom-6 right-2 z-[1000] flex gap-2 items-end">
            {/* Toggles (left) */}
            <div className="flex flex-col gap-2">
                {/* View Toggle */}
                <div className="flex bg-surface rounded-md overflow-hidden shadow-md">
                    <button
                        onClick={() => setView('original')}
                        className={`w-16 py-2 text-sm font-medium transition-colors ${
                            view === 'original' ? 'bg-primary text-white' : 'text-text hover:bg-surface-muted'
                        }`}
                    >
                        Origin
                    </button>
                    <button
                        onClick={() => setView('active')}
                        className={`w-16 py-2 text-sm font-medium transition-colors ${
                            view === 'active' ? 'bg-primary text-white' : 'text-text hover:bg-surface-muted'
                        }`}
                    >
                        Active
                    </button>
                </div>

                {/* Display Mode Toggle */}
                <div className="flex bg-surface rounded-md overflow-hidden shadow-md">
                    <button
                        onClick={() => setDisplayMode('cluster')}
                        className={`w-16 py-2 text-sm font-medium transition-colors ${
                            displayMode === 'cluster' ? 'bg-primary text-white' : 'text-text hover:bg-surface-muted'
                        }`}
                    >
                        Cluster
                    </button>
                    <button
                        onClick={() => setDisplayMode('progressive')}
                        className={`w-16 py-2 text-sm font-medium transition-colors ${
                            displayMode === 'progressive' ? 'bg-primary text-white' : 'text-text hover:bg-surface-muted'
                        }`}
                    >
                        Dot
                    </button>
                </div>

                {/* Tile Layer Toggle */}
                <div className="flex bg-surface rounded-md overflow-hidden shadow-md">
                    <button
                        onClick={() => setTileLayer('osm')}
                        className={`w-16 py-2 text-sm font-medium transition-colors ${
                            tileLayer === 'osm' ? 'bg-primary text-white' : 'text-text hover:bg-surface-muted'
                        }`}
                    >
                        OSM
                    </button>
                    <button
                        onClick={() => setTileLayer('voyager')}
                        className={`w-16 py-2 text-sm font-medium transition-colors ${
                            tileLayer === 'voyager' ? 'bg-primary text-white' : 'text-text hover:bg-surface-muted'
                        }`}
                    >
                        Voyager
                    </button>
                </div>
            </div>

            {/* Map Controls (right) */}
            <div className="flex flex-col gap-2 items-end">
                {/* Locate */}
                <button
                    onClick={handleLocate}
                    className={`${mapButtonClass} rounded-md shadow-md`}
                    title="Locate Me"
                >
                    <LocationIcon />
                </button>

                {/* Zoom */}
                <div className="flex flex-col rounded-md shadow-md overflow-hidden">
                    <button
                        onClick={handleZoomIn}
                        className={`${mapButtonClass} border-b border-border`}
                        title="Zoom In"
                    >
                        <span className="text-lg font-medium">+</span>
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className={mapButtonClass}
                        title="Zoom Out"
                    >
                        <span className="text-lg font-medium">−</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MapControls;
