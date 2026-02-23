import { useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import type { Artist } from '../../../types/artist';
import { CLUSTER_CONFIG } from './clusterConstants';
import { generateGridPositions, groupMarkersByCity } from './gridLayout';
import {
  setupMarkerPopupEvents,
  type PopupEventHandlers,
} from './setupMarkerPopup';

interface ExpandedClusterState {
  originalCluster: L.MarkerCluster;
  expandedMarkers: L.Marker[];
  centerMarker?: L.Marker;
}

interface UseClusterExpansionOptions extends PopupEventHandlers {
  map: L.Map;
}

// Generate unique key for a cluster based on its position
const getClusterKey = (cluster: L.MarkerCluster): string => {
  const latLng = cluster.getLatLng();
  return `${latLng.lat.toFixed(6)},${latLng.lng.toFixed(6)}`;
};

/**
 * Hook for managing cluster expansion/collapse behavior.
 * Supports multiple expanded clusters simultaneously.
 */
export const useClusterExpansion = ({
  map,
  onArtistSelect,
  onArtistDeselect,
  onEditArtist,
  onDeleteArtist,
}: UseClusterExpansionOptions) => {
  const expandedStatesRef = useRef<Map<string, ExpandedClusterState>>(new Map());

  const collapseOne = useCallback((key: string) => {
    const state = expandedStatesRef.current.get(key);
    if (!state) return;

    // Remove expanded markers from map
    state.expandedMarkers.forEach((marker) => {
      map.removeLayer(marker);
    });
    if (state.centerMarker) {
      map.removeLayer(state.centerMarker);
    }

    // Show the original cluster marker again (only if still in DOM)
    const clusterIcon = (state.originalCluster as any)._icon as HTMLElement | undefined;
    if (clusterIcon && clusterIcon.isConnected) {
      clusterIcon.style.opacity = '1';
      clusterIcon.style.pointerEvents = '';
    }

    expandedStatesRef.current.delete(key);
  }, [map]);

  // Collapse all expanded clusters
  const collapseAll = useCallback(() => {
    const keys = Array.from(expandedStatesRef.current.keys());
    keys.forEach((key) => collapseOne(key));
  }, [collapseOne]);


  // Expand cluster with grid layout, grouped by city
  const expandCluster = useCallback(
    (cluster: L.MarkerCluster) => {
      const clusterKey = getClusterKey(cluster);

      if (expandedStatesRef.current.has(clusterKey)) {
        collapseOne(clusterKey);
        return;
      }

      const childMarkers = cluster.getAllChildMarkers() as L.Marker[];
      if (childMarkers.length === 0) return;

      const clusterLatLng = cluster.getLatLng();
      const clusterPixel = map.latLngToLayerPoint(clusterLatLng);

      const sortedMarkers = groupMarkersByCity(childMarkers, (marker) => {
        return (marker as L.Marker & { _artistData?: Artist })._artistData;
      });

      // Generate grid positions for artists
      const { positions: gridPositions, collapseOffset } = generateGridPositions(
        sortedMarkers.length,
        CLUSTER_CONFIG.gridSpacing
      );

      const expandedMarkers: L.Marker[] = [];

      // Create collapse function for this specific cluster
      const collapseThisCluster = () => collapseOne(clusterKey);

      sortedMarkers.forEach((marker, index) => {
        const gridOffset = gridPositions[index];
        const expandedPixel = clusterPixel.add(gridOffset);
        const expandedLatLng = map.layerPointToLatLng(expandedPixel);

        const artistData = (marker as L.Marker & { _artistData?: Artist })
          ._artistData;

        // Create expanded marker with transition class
        const originalIcon = marker.options.icon as L.DivIcon;
        const expandedIcon = L.divIcon({
          ...originalIcon.options,
          className: `${originalIcon.options.className || ''} expanded-cluster-marker`,
        });

        const expandedMarker = L.marker(expandedLatLng, {
          icon: expandedIcon,
        });

        const popup = marker.getPopup();
        if (popup) {
          expandedMarker.bindPopup(popup.getContent() as string, popup.options);
        }

        if (artistData) {
          setupMarkerPopupEvents({
            map,
            marker: expandedMarker,
            artist: artistData,
            onArtistSelect,
            onArtistDeselect,
            onEditArtist,
            onDeleteArtist,
            onBeforeAction: collapseThisCluster,
          });
        }

        expandedMarker.addTo(map);
        expandedMarkers.push(expandedMarker);
      });

      // Hide the original cluster marker
      const clusterIcon = (cluster as any)._icon as HTMLElement | undefined;
      if (clusterIcon) {
        clusterIcon.style.opacity = '0';
        clusterIcon.style.pointerEvents = 'none';
      }

      expandedStatesRef.current.set(clusterKey, {
        originalCluster: cluster,
        expandedMarkers,
      });
    },
    [
      map,
      collapseOne,
      onArtistSelect,
      onArtistDeselect,
      onEditArtist,
      onDeleteArtist,
    ]
  );

  // Collapse all expanded clusters when zoom level changes
  useEffect(() => {
    const handleZoom = () => {
      collapseAll();
    };

    map.on('zoomstart', handleZoom);
    return () => {
      map.off('zoomstart', handleZoom);
    };
  }, [map, collapseAll]);

  // Collapse all on map click (empty space)
  useEffect(() => {
    const handleMapClick = () => {
      if (expandedStatesRef.current.size > 0) {
        collapseAll();
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, collapseAll]);

  return {
    expandCluster,
    collapseCluster: collapseAll,
  };
};
