import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Artist, LocationView } from '../../types/artist';
import ArtistProfile from '../ArtistProfile';
import { createArtistMarker, preloadArtistImages } from '../../utils/mapUtils';
import {
  CLUSTER_CONFIG,
  createClusterIconFactory,
  setupMarkerPopupEvents,
  useClusterExpansion,
} from './cluster';

interface ArtistClusterProps {
  artists: Artist[];
  view: LocationView;
  onArtistSelect?: (artist: Artist) => void;
  onArtistDeselect?: () => void;
  onEditArtist?: (artist: Artist) => void;
  onDeleteArtist?: (artist: Artist) => void;
  focusedArtist?: Artist | null;
  onFocusedArtistHandled?: () => void;
}

const ArtistCluster = ({
  artists,
  view,
  onArtistSelect,
  onArtistDeselect,
  onEditArtist,
  onDeleteArtist,
  focusedArtist,
  onFocusedArtistHandled,
}: ArtistClusterProps) => {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const getClusterGroup = useCallback(() => clusterRef.current, []);

  const { expandCluster, collapseCluster } = useClusterExpansion({
    map,
    onArtistSelect,
    onArtistDeselect,
    onEditArtist,
    onDeleteArtist,
    getClusterGroup,
  });

  useEffect(() => {
    preloadArtistImages(artists);
  }, [artists]);

  // Create artist markers
  const createMarkerForArtist = useCallback((artist: Artist): L.Marker => {
    const icon = createArtistMarker(artist);
    const location = view === 'active' ? artist.activeLocation : artist.originalLocation;
    const displayCoords = view === 'active'
      ? artist.activeLocationDisplayCoordinates
      : artist.originalLocationDisplayCoordinates;
    const coords = displayCoords || location.coordinates;

    const marker = L.marker([coords.lat, coords.lng], { icon });
    (marker as L.Marker & { _artistData?: Artist })._artistData = artist;

    const popupContent = renderToStaticMarkup(<ArtistProfile artist={artist} />);
    marker.bindPopup(popupContent, {
      className: 'artist-popup',
      closeButton: false,
      minWidth: 320,
    });

    setupMarkerPopupEvents({
      map,
      marker,
      artist,
      onArtistSelect,
      onArtistDeselect,
      onEditArtist,
      onDeleteArtist,
    });

    return marker;
  }, [map, view, onArtistSelect, onArtistDeselect, onEditArtist, onDeleteArtist]);

  // Main effect for cluster management
  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: CLUSTER_CONFIG.maxClusterRadius,
      disableClusteringAtZoom: CLUSTER_CONFIG.disableClusteringAtZoomLevel,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: createClusterIconFactory({ map }),
    });

    cluster.on('clusterclick', (e: L.LeafletEvent) => {
      expandCluster((e as L.LeafletEvent & { layer: L.MarkerCluster }).layer);
    });

    clusterRef.current = cluster;

    // Add markers to cluster
    artists.forEach((artist) => {
      const marker = createMarkerForArtist(artist);
      markersRef.current.set(artist.id, marker);
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);

    // Force refresh
    const refreshTimeout = setTimeout(() => {
      cluster.refreshClusters();
    }, CLUSTER_CONFIG.refreshDelay);

    return () => {
      clearTimeout(refreshTimeout);
      collapseCluster();
      if (map.hasLayer(cluster)) map.removeLayer(cluster);
      clusterRef.current = null;
      markersRef.current.clear();
    };
  }, [map, artists, view, createMarkerForArtist, expandCluster, collapseCluster]);

  // Handle focused artist
  useEffect(() => {
    if (!focusedArtist) return;

    const location = view === 'active'
      ? focusedArtist.activeLocation
      : focusedArtist.originalLocation;

    map.flyTo([location.coordinates.lat, location.coordinates.lng], 11, {
      duration: 2,
    });

    setTimeout(() => {
      const marker = markersRef.current.get(focusedArtist.id);

      if (marker && clusterRef.current) {
        clusterRef.current.zoomToShowLayer(marker, () => {
          marker.openPopup();
          onArtistSelect?.(focusedArtist);
        });
      } else if (marker) {
        marker.openPopup();
        onArtistSelect?.(focusedArtist);
      }
      onFocusedArtistHandled?.();
    }, 1600);
  }, [focusedArtist, map, view, onArtistSelect, onFocusedArtistHandled]);

  return null;
};

export default ArtistCluster;
