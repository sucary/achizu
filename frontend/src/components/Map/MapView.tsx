import { useEffect, useMemo, useCallback, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, ScaleControl, AttributionControl, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { getArtists, getArtistsByUsername, getCityById, type SearchResult } from '../../services/api';
import type { Artist, LocationView, SelectionMode } from '../../types/artist';
import { getDisplayArtists } from '../../utils/mapUtils';
import MapControls from './buttons/MapControls';
import ArtistCluster from './ArtistCluster';
import ArtistProgressiveView from './ArtistProgressiveView';
import MapClickHandler from './MapClickHandler';
import { useQuery } from '@tanstack/react-query';

const ZoomLogger = () => {
    useMapEvents({
        zoomend: (e) => {
            console.log(`[MapView] Zoom level: ${e.target.getZoom()}`);
        },
    });
    return null;
};

// Component to handle clicks on empty map areas
const MapEmptyClickHandler = ({ onClick }: { onClick: () => void }) => {
    useMapEvents({
        click: (e) => {
            const target = (e.originalEvent as any)?.target;
            if (target) {
                // Ignore clicks on following elements
                const isInteractive = target.closest('.leaflet-control') ||
                    target.closest('.leaflet-bar') ||
                    target.closest('button') ||
                    target.closest('.leaflet-marker-icon') ||
                    target.closest('.marker-cluster') ||
                    target.closest('.leaflet-popup');

                if (isInteractive) {
                    return;
                }
            }
            onClick();
        }
    });
    return null;
};

interface MapViewProps {
    username?: string;
    selectionMode?: SelectionMode | null;
    onLocationPick?: ((result: SearchResult | null) => void) | null;
    onEditArtist?: (artist: Artist) => void;
    onDeleteArtist?: (artist: Artist) => void;
    onEmptyClick?: () => void;
}

const MapView = ({ username, selectionMode, onLocationPick, onEditArtist, onDeleteArtist, onEmptyClick }: MapViewProps) => {
    const defaultCenter: LatLngExpression = [35.6762, 139.6503]; // Tokyo
    const defaultZoom = 4;
    const [view, setViewState] = useState<LocationView>('active');
    const [displayMode, setDisplayModeState] = useState<'cluster' | 'progressive'>('cluster');

    const setView = (v: LocationView) => {
        console.log(`[MapView] Location view: ${v}`);
        setViewState(v);
    };
    const setDisplayMode = (m: 'cluster' | 'progressive') => {
        console.log(`[MapView] Display mode: ${m}`);
        setDisplayModeState(m);
    };
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

    const {data: artists, isLoading} = useQuery({
        queryKey: ['artists', username],
        queryFn: () => username ? getArtistsByUsername(username) : getArtists(),
    });

    const { data: selectedCity } = useQuery({
        queryKey: ['city', selectedCityId],
        queryFn: () => {
            console.log('Fetching city:', selectedCityId);
            return selectedCityId ? getCityById(selectedCityId) : null;
        },
        enabled: !!selectedCityId
    });

    useEffect(() => {
        console.log('Selected City Data:', selectedCity);
    }, [selectedCity]);

    const displayArtists = useMemo(() =>
        getDisplayArtists({}, view, artists || []),
        [artists, view]
    );

    const handleArtistSelect = useCallback((artist: Artist) => {
        console.log('Artist selected:', artist.name);
        const cityId = view === 'active' ? artist.activeCityId : artist.originalCityId;
        console.log('Setting selected city ID:', cityId);
        setSelectedCityId(cityId);
    }, [view]);

    const handleArtistDeselect = useCallback(() => {
        console.log('Artist deselected, clearing boundary');
        setSelectedCityId(null);
    }, []);




    return (
        <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
        >
            <ZoomLogger />
            <MapControls view={view} setView={setView} displayMode={displayMode} setDisplayMode={setDisplayMode} />
            <ScaleControl position="bottomleft" imperial={false} />
            <AttributionControl position="bottomright" />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {displayMode === 'cluster' ? (
                <ArtistCluster
                    artists={displayArtists}
                    view={view}
                    onArtistSelect={handleArtistSelect}
                    onArtistDeselect={handleArtistDeselect}
                    onEditArtist={onEditArtist}
                    onDeleteArtist={onDeleteArtist}
                />
            ) : (
                <ArtistProgressiveView
                    artists={displayArtists}
                    view={view}
                    onArtistSelect={handleArtistSelect}
                    onArtistDeselect={handleArtistDeselect}
                    onEditArtist={onEditArtist}
                    onDeleteArtist={onDeleteArtist}
                />
            )}
            {selectionMode?.active && (
                <MapClickHandler onLocationPick={onLocationPick ?? null} />
            )}
            {!selectionMode?.active && onEmptyClick && (
                <MapEmptyClickHandler onClick={onEmptyClick} />
            )}
            {selectedCity && selectedCity.boundary && (
                <GeoJSON
                    key={selectedCity.id}
                    data={selectedCity.boundary}
                    style={{
                        color: '#ff0000',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.1
                    }}
                />
            )}
            {selectedCity && selectedCity.rawBoundary && (
                <GeoJSON
                    key={`${selectedCity.id}-raw`}
                    data={selectedCity.rawBoundary}
                    style={{
                        color: '#3b82f6',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.1,
                        dashArray: '5, 5'
                    }}
                />
            )}
        </MapContainer>
    );
};


export default MapView;