import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { getArtists } from '../../services/api';
import type { Artist, LocationView } from '../../types/artist';
import { getDisplayArtists } from '../../utils/mapUtils';
import LocateControl from './LocateMeButton';
import ArtistCluster from './ArtistCluster';
import ViewToggleButton from './ViewToggleButton';
import { useQuery } from '@tanstack/react-query';

const MapView = () => {
    const defaultCenter: LatLngExpression = [35.6762, 139.6503]; // Tokyo
    const defaultZoom = 4;
    const [view, setView] = useState<LocationView>('active');

    const {data: artists, isLoading} = useQuery({
        queryKey: ['artists'],
        queryFn: () => getArtists(),
    });

    const displayArtists = useMemo(() =>
        getDisplayArtists(artists || [], view),
        [artists, view]
    );

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
            <ArtistCluster artists={displayArtists} view={view} />
        </MapContainer>
    );
};


export default MapView;