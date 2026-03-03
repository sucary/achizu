import { useMapEvents, useMap } from 'react-leaflet';
import { useEffect } from 'react';

interface Coordinates {
    lat: number;
    lng: number;
}

interface MapClickHandlerProps {
    onLocationPick: ((coordinates: Coordinates | null) => void) | null;
}

const MapClickHandler = ({ onLocationPick }: MapClickHandlerProps) => {
    const map = useMap();

    // Add/remove class to map container for cursor styling
    useEffect(() => {
        const container = map.getContainer();
        container.classList.add('location-selection-mode');

        return () => {
            container.classList.remove('location-selection-mode');
        };
    }, [map]);

    useMapEvents({
        click: (e) => {
            // Check if the click originated from a Leaflet control or button
            const target = e.originalEvent?.target as HTMLElement | null;
            if (target) {
                // Check if click was on a control or its children
                const isControl = target.closest('.leaflet-control') ||
                                 target.closest('.leaflet-bar') ||
                                 target.closest('button') ||
                                 target.closest('a.leaflet-control');

                if (isControl) {
                    return; // Ignore clicks on controls
                }
            }

            // Just pass coordinates - LocationSearch will handle reverse search
            if (onLocationPick) {
                onLocationPick({ lat: e.latlng.lat, lng: e.latlng.lng });
            }
        }
    });

    return (
        <>
            {/* Top banner with instructions */}
            <div className="absolute top-0 left-0 right-0 z-modal bg-primary text-white px-4 py-3 shadow-lg">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm font-medium">
                            Click anywhere on the map to select a location
                        </p>
                    </div>
                    <button
                        onClick={() => onLocationPick?.(null)}
                        className="px-4 py-1.5 text-sm bg-surface text-primary hover:bg-surface-muted rounded-md font-medium transition-colors"
                        style={{ cursor: 'default' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>

            {/* Subtle map overlay */}
            <div className="absolute inset-0 bg-black/5 z-[998] pointer-events-none" />

            {/* CSS for crosshair cursor */}
            <style>{`
                /* Apply crosshair to entire map in selection mode */
                .leaflet-container.location-selection-mode,
                .leaflet-container.location-selection-mode .leaflet-pane,
                .leaflet-container.location-selection-mode .leaflet-tile-pane,
                .leaflet-container.location-selection-mode .leaflet-overlay-pane,
                .leaflet-container.location-selection-mode .leaflet-marker-pane,
                .leaflet-container.location-selection-mode .leaflet-tile,
                .leaflet-container.location-selection-mode .leaflet-map-pane,
                .leaflet-container.location-selection-mode .leaflet-proxy,
                .leaflet-container.location-selection-mode .leaflet-grab,
                .leaflet-container.location-selection-mode .leaflet-interactive {
                    cursor: crosshair !important;
                }
                /* Override for buttons - must come after and use higher specificity */
                .location-selection-mode button,
                .leaflet-container.location-selection-mode button,
                .leaflet-container.location-selection-mode .leaflet-control button,
                .leaflet-container.location-selection-mode .leaflet-control a,
                .leaflet-container.location-selection-mode .leaflet-bar a {
                    cursor: default !important;
                }
            `}</style>
        </>
    );
};

export default MapClickHandler;
