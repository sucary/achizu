import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, ScaleControl, AttributionControl, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { getArtists, getArtistsByUsername, getFeaturedArtists, getCityById } from '../../services/api';
import type { Artist, LocationView, SelectionMode } from '../../types/artist';
import { getDisplayArtists } from '../../utils/mapUtils';
import MapControls from './buttons/MapControls';
import ArtistCluster, { type ArtistClusterHandle } from './ArtistCluster';
import MapClickHandler from './MapClickHandler';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';

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
            const target = e.originalEvent?.target as HTMLElement | null;
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

// Get zoom level based on location type
const getZoomForLocationType = (locationType?: string): number => {
    switch (locationType) {
        case 'country':
            return 5;
        case 'state':
        case 'province':
        case 'region':
            return 8;
        case 'county':
        case 'district':
            return 9;
        case 'city':
        case 'town':
        case 'municipality':
            return 11;
        case 'village':
        case 'suburb':
        case 'borough':
            return 13;
        case 'neighbourhood':
        case 'quarter':
            return 15;
        default:
            return 12;
    }
};

// Component to handle flying to a focused location
const FocusedLocationHandler = ({
    location,
    onHandled
}: {
    location: { lat: number; lng: number; locationType?: string } | null;
    onHandled?: () => void;
}) => {
    const map = useMap();

    useEffect(() => {
        if (!location) return;

        const zoom = getZoomForLocationType(location.locationType);
        map.flyTo([location.lat, location.lng], zoom, {
            duration: 1.5
        });

        onHandled?.();
    }, [location, map, onHandled]);

    return null;
};

interface Coordinates {
    lat: number;
    lng: number;
    locationType?: string;
}

interface MapViewProps {
    username?: string;
    viewingFeatured?: boolean;
    selectionMode?: SelectionMode | null;
    onLocationPick?: ((coordinates: Coordinates | null) => void) | null;
    onEditArtist?: (artist: Artist) => void;
    onDeleteArtist?: (artist: Artist) => void;
    onEmptyClick?: () => void;
    focusedArtist?: Artist | null;
    onFocusedArtistHandled?: () => void;
    focusedLocation?: Coordinates | null;
    onFocusedLocationHandled?: () => void;
    focusedCityId?: string | null;
    isAuthenticated?: boolean;
}

export type TileLayerType = 'osm' | 'voyager';

const TILE_LAYERS: Record<TileLayerType, { url: string; attribution: string; subdomains?: string }> = {
    osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    voyager: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
    },
};

const MapView = ({ username, viewingFeatured, selectionMode, onLocationPick, onEditArtist, onDeleteArtist, onEmptyClick, focusedArtist, onFocusedArtistHandled, focusedLocation, onFocusedLocationHandled, focusedCityId, isAuthenticated = true }: MapViewProps) => {
    const { profile } = useAuth();
    const isAdmin = profile?.isAdmin ?? false;
    const defaultCenter: LatLngExpression = [35.6762, 139.6503]; // Tokyo
    const defaultZoom = 4;
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    const [view, setView] = useState<LocationView>('active');
    const [tileLayer, setTileLayer] = useState<TileLayerType>('voyager');
    const [hasExpandedClusters, setHasExpandedClusters] = useState(false);
    const clusterRef = useRef<ArtistClusterHandle>(null);

    const {data: artists} = useQuery({
        queryKey: ['artists', username, viewingFeatured],
        queryFn: () => {
            if (viewingFeatured) return getFeaturedArtists();
            if (username) return getArtistsByUsername(username);
            return getArtists();
        },
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

    // Set selectedCityId when focusedCityId changes (from main search)
    useEffect(() => {
        if (focusedCityId) {
            setSelectedCityId(focusedCityId);
        }
    }, [focusedCityId]);

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
            worldCopyJump={true}
            maxBounds={[[-90, -Infinity], [90, Infinity]]}
            maxBoundsViscosity={1.0}
        >
            <ZoomLogger />
            <MapControls
                view={view}
                setView={setView}
                tileLayer={tileLayer}
                setTileLayer={setTileLayer}
                hasExpandedClusters={hasExpandedClusters}
                onToggleClusters={() => hasExpandedClusters
                    ? clusterRef.current?.collapseAll()
                    : clusterRef.current?.expandAll()}
                showViewToggle={isAuthenticated && !viewingFeatured}
            />
            <ScaleControl position="bottomleft" imperial={false} />
            <AttributionControl position="bottomright" />
            <TileLayer
                key={tileLayer}
                attribution={TILE_LAYERS[tileLayer].attribution}
                url={TILE_LAYERS[tileLayer].url}
                subdomains={TILE_LAYERS[tileLayer].subdomains || 'abc'}
            />
            <ArtistCluster
                ref={clusterRef}
                artists={displayArtists}
                view={view}
                onArtistSelect={handleArtistSelect}
                onArtistDeselect={handleArtistDeselect}
                onEditArtist={onEditArtist}
                onDeleteArtist={onDeleteArtist}
                focusedArtist={focusedArtist}
                onFocusedArtistHandled={onFocusedArtistHandled}
                onExpansionChange={setHasExpandedClusters}
            />
            {selectionMode?.active && (
                <MapClickHandler onLocationPick={onLocationPick ?? null} />
            )}
            {!selectionMode?.active && onEmptyClick && (
                <MapEmptyClickHandler onClick={onEmptyClick} />
            )}
            {focusedLocation && (
                <FocusedLocationHandler
                    location={focusedLocation}
                    onHandled={onFocusedLocationHandled}
                />
            )}
            {selectedCity && selectedCity.boundary && (
                <GeoJSON
                    key={selectedCity.id}
                    data={selectedCity.boundary}
                    style={{
                        color: '#FA233B',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.1
                    }}
                />
            )}
            {isAdmin && selectedCity && selectedCity.rawBoundary && (
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