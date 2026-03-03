import { useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import type { Artist } from '../../../types/artist';
import { CLUSTER_CONFIG } from './clusterConstants';
import { generateGeoPositions } from './layout';
import {
  setupMarkerPopupEvents,
  type PopupEventHandlers,
} from './setupMarkerPopup';

interface ExpandedClusterState {
  originalCluster: L.MarkerCluster;
  expandedMarkers: L.Marker[];
  connectionLines: L.Polyline[];
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

    // Remove expanded markers and connection lines from map
    state.expandedMarkers.forEach((marker) => {
      map.removeLayer(marker);
    });
    state.connectionLines.forEach((line) => {
      map.removeLayer(line);
    });

    // Show the original cluster marker again (only if still in DOM)
    const clusterIcon = (state.originalCluster as unknown as { _icon?: HTMLElement })._icon;
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


  // Expand cluster with geographic layout
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

      // Generate positions with geographic layout
      const { positions: geoPositions } = generateGeoPositions(
        childMarkers,
        clusterLatLng,
        map,
        CLUSTER_CONFIG.gridSpacing
      );

      const expandedMarkers: L.Marker[] = [];
      const connectionLines: L.Polyline[] = [];

      // Create collapse function for this specific cluster
      const collapseThisCluster = () => collapseOne(clusterKey);

      childMarkers.forEach((marker, index) => {
        const offset = geoPositions[index];
        const expandedPixel = clusterPixel.add(offset);
        const expandedLatLng = map.layerPointToLatLng(expandedPixel);

        const artistData = (marker as L.Marker & { _artistData?: Artist })
          ._artistData;

        // Draw line from expanded position to artist's actual location
        const line = L.polyline([expandedLatLng, marker.getLatLng()], {
          color: '#666',
          weight: 1.5,
          opacity: 0.7,
          dashArray: '4 4',
          interactive: false,
        }).addTo(map);
        connectionLines.push(line);

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

        // Highlight connection line on popup open/close
        expandedMarker.on('popupopen', () => {
          line.setStyle({ color: '#666', weight: 3, opacity: 1 });
        });
        expandedMarker.on('popupclose', () => {
          line.setStyle({ color: '#666', weight: 1.5, opacity: 0.7, dashArray: '4 4' });
        });

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
      const clusterIcon = (cluster as unknown as { _icon?: HTMLElement })._icon;
      if (clusterIcon) {
        clusterIcon.style.opacity = '0';
        clusterIcon.style.pointerEvents = 'none';
      }

      expandedStatesRef.current.set(clusterKey, {
        originalCluster: cluster,
        expandedMarkers,
        connectionLines,
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
