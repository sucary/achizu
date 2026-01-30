import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, ZoomControl, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { getArtists, getCityById, type SearchResult } from '../../services/api';
import type { Artist, LocationView, SelectionMode } from '../../types/artist';
import { getDisplayArtists } from '../../utils/mapUtils';
import LocateControl from './buttons/LocateMeButton';
import ArtistCluster from './ArtistCluster';
import ViewToggleButton from './buttons/ViewToggleButton';
import MapClickHandler from './MapClickHandler';
import { useQuery } from '@tanstack/react-query';

interface MapViewProps {
    selectionMode?: SelectionMode | null;
    onLocationPick?: ((result: SearchResult | null) => void) | null;
}

const MapView = ({ selectionMode, onLocationPick }: MapViewProps) => {
    const defaultCenter: LatLngExpression = [35.6762, 139.6503]; // Tokyo
    const defaultZoom = 4;
    const [view, setView] = useState<LocationView>('active');
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

    const {data: artists, isLoading} = useQuery({
        queryKey: ['artists'],
        queryFn: () => getArtists(),
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

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p>Loading artists...</p>
            </div>
        );
    }

    return (
        <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            className="h-full w-full"
            zoomControl={false}
        >
            <ViewToggleButton view={view} setView={setView} />
            <ZoomControl position="bottomright" />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocateControl />
            <ArtistCluster
                artists={displayArtists}
                view={view}
                onArtistSelect={handleArtistSelect}
                onArtistDeselect={handleArtistDeselect}
            />
            {selectionMode?.active && (
                <MapClickHandler onLocationPick={onLocationPick ?? null} />
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