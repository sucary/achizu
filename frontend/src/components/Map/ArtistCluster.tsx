import { useEffect, useRef } from 'react';
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
  const markerClusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  const { expandCluster, collapseCluster } = useClusterExpansion({
    map,
    onArtistSelect,
    onArtistDeselect,
    onEditArtist,
    onDeleteArtist,
  });

  useEffect(() => {
    preloadArtistImages(artists);
  }, [artists]);

  useEffect(() => {
    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: CLUSTER_CONFIG.maxClusterRadius,
      disableClusteringAtZoom: CLUSTER_CONFIG.disableClusteringAtZoomLevel,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: createClusterIconFactory({ map }),
    });

    markerClusterGroupRef.current = markerClusterGroup;

    // Handle cluster click - expand instead of zoom
    markerClusterGroup.on('clusterclick', (e: L.LeafletEvent) => {
      expandCluster((e as L.LeafletEvent & { layer: L.MarkerCluster }).layer);
    });

    // Add artist markers
    artists.forEach((artist) => {
      const icon = createArtistMarker(artist);
      const location =
        view === 'active' ? artist.activeLocation : artist.originalLocation;
      const marker = L.marker(
        [location.coordinates.lat, location.coordinates.lng],
        { icon }
      );

      // Store artist data on marker for later retrieval
      (marker as L.Marker & { _artistData?: Artist })._artistData = artist;

      // Bind the popup
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

      markerClusterGroup.addLayer(marker);
    });

    map.addLayer(markerClusterGroup);

    // Force refresh clusters after map is fully ready
    const refreshTimeout = setTimeout(() => {
      markerClusterGroup.refreshClusters();
    }, CLUSTER_CONFIG.refreshDelay);

    return () => {
      clearTimeout(refreshTimeout);
      collapseCluster();
      map.removeLayer(markerClusterGroup);
      markerClusterGroupRef.current = null;
    };
  }, [
    map,
    artists,
    view,
    onArtistSelect,
    onArtistDeselect,
    onEditArtist,
    onDeleteArtist,
    expandCluster,
    collapseCluster,
  ]);

  // Handle focused artist
  useEffect(() => {
    if (!focusedArtist || !markerClusterGroupRef.current) return;

    const markerClusterGroup = markerClusterGroupRef.current;
    let targetMarker: L.Marker | null = null;

    // Find the marker for the focused artist
    markerClusterGroup.eachLayer((layer) => {
      const marker = layer as L.Marker & { _artistData?: Artist };
      if (marker._artistData?.id === focusedArtist.id) {
        targetMarker = marker;
      }
    });

    if (targetMarker) {
      const location = view === 'active'
        ? focusedArtist.activeLocation
        : focusedArtist.originalLocation;

      // Fly to the artist's location
      map.flyTo([location.coordinates.lat, location.coordinates.lng], 12, {
        duration: 0.8,
      });

      // Open popup after fly animation completes
      setTimeout(() => {
        if (targetMarker) {
          // Make sure the marker is visible
          markerClusterGroup.zoomToShowLayer(targetMarker, () => {
            targetMarker!.openPopup();
            onArtistSelect?.(focusedArtist);
          });
        }
      }, 850);
    }

    onFocusedArtistHandled?.();
  }, [focusedArtist, map, view, onArtistSelect, onFocusedArtistHandled]);

  return null;
};

export default ArtistCluster;
