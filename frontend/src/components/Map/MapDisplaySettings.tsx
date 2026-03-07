import { useState } from 'react';
import type { LocationView } from '../../types/artist';
import type { TileLayerType, DisplayMode } from './MapView';

interface MapDisplaySettingsProps {
    view: LocationView;
    setView: (view: LocationView) => void;
    displayMode: DisplayMode;
    setDisplayMode: (mode: DisplayMode) => void;
    tileLayer: TileLayerType;
    setTileLayer: (layer: TileLayerType) => void;
}

export function MapDisplaySettings({
    view,
    setView,
    displayMode,
    setDisplayMode,
    tileLayer,
    setTileLayer,
}: MapDisplaySettingsProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleBtnClass = (active: boolean) =>
        `px-3 py-1.5 text-xs font-medium transition-colors ${
            active ? 'bg-primary text-white' : 'text-text hover:bg-surface-muted'
        }`;

    return (
        <div
            className="flex items-center"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            {/* Toggles (appear on left when hovered) */}
            {isOpen && (
                <div className="flex gap-2 mr-2 p-2 bg-surface border border-border rounded-md shadow-lg">
                    {/* View Toggle */}
                    <div className="flex rounded-md overflow-hidden border border-border">
                        <button
                            onClick={() => setView('original')}
                            className={toggleBtnClass(view === 'original')}
                        >
                            Origin
                        </button>
                        <button
                            onClick={() => setView('active')}
                            className={toggleBtnClass(view === 'active')}
                        >
                            Active
                        </button>
                    </div>

                    {/* Display Mode Toggle */}
                    <div className="flex rounded-md overflow-hidden border border-border">
                        <button
                            onClick={() => setDisplayMode('cluster')}
                            className={toggleBtnClass(displayMode === 'cluster')}
                        >
                            Cluster
                        </button>
                        <button
                            onClick={() => setDisplayMode('progressive')}
                            className={toggleBtnClass(displayMode === 'progressive')}
                        >
                            Dot
                        </button>
                    </div>

                    {/* Tile Layer Toggle */}
                    <div className="flex rounded-md overflow-hidden border border-border">
                        <button
                            onClick={() => setTileLayer('osm')}
                            className={toggleBtnClass(tileLayer === 'osm')}
                        >
                            OSM
                        </button>
                        <button
                            onClick={() => setTileLayer('voyager')}
                            className={toggleBtnClass(tileLayer === 'voyager')}
                        >
                            Voyager
                        </button>
                    </div>
                </div>
            )}

            {/* Arrow trigger */}
            <svg
                className={`w-6 h-6 text-text-secondary hover:text-text cursor-pointer transition-all ${isOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="15 18 9 12 15 6" />
            </svg>
        </div>
    );
}
