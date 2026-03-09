import { useRef, useCallback, useEffect, useState } from 'react';
import L from 'leaflet';
import type { Artist } from '../types/artist';
import { CLUSTER_CONFIG } from '../constants/mapCluster';
import { generateGeoPositions } from '../utils/map/layout';
import {
  setupMarkerPopupEvents,
  type PopupEventHandlers,
} from '../utils/map/setupMarkerPopup';

interface ExpandedClusterState {
  originalCluster: L.MarkerCluster;
  expandedMarkers: L.Marker[];
  connectionLines: L.Polyline[];
}

interface UseClusterExpansionOptions extends PopupEventHandlers {
  map: L.Map;
  getClusterGroup?: () => L.MarkerClusterGroup | null;
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
  getClusterGroup,
}: UseClusterExpansionOptions) => {
  const expandedStatesRef = useRef<Map<string, ExpandedClusterState>>(new Map());
  const popupJustClosedRef = useRef(false);
  const [hasExpandedClusters, setHasExpandedClusters] = useState(false);

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
    setHasExpandedClusters(expandedStatesRef.current.size > 0);
  }, [map]);

  // Collapse all expanded clusters
  const collapseAll = useCallback(() => {
    const keys = Array.from(expandedStatesRef.current.keys());
    keys.forEach((key) => collapseOne(key));
  }, [collapseOne]);


  // Expand cluster with geographic layout, avoiding other clusters and expanded markers
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

      // Collect positions of other clusters and already expanded markers to avoid
      const avoidPixels: L.Point[] = [];
      const clusterGroup = getClusterGroup?.();

      if (clusterGroup) {
        // Get other visible cluster and marker positions
        const visibleLayers = (clusterGroup as unknown as { _featureGroup?: L.FeatureGroup })._featureGroup;
        if (visibleLayers) {
          visibleLayers.eachLayer((layer) => {
            const maybeCluster = layer as L.MarkerCluster & { _childCount?: number };
            if (maybeCluster._childCount) {
              // Avoid other clusters
              if (maybeCluster !== cluster) {
                avoidPixels.push(map.latLngToLayerPoint(maybeCluster.getLatLng()));
              }
            } else if ((layer as L.Marker).getLatLng) {
              // Avoid other markers
              avoidPixels.push(map.latLngToLayerPoint((layer as L.Marker).getLatLng()));
            }
          });
        }
      }

      // Add already expanded markers from other clusters
      expandedStatesRef.current.forEach((state, key) => {
        if (key !== clusterKey) {
          state.expandedMarkers.forEach((marker) => {
            avoidPixels.push(map.latLngToLayerPoint(marker.getLatLng()));
          });
        }
      });

      // Generate positions with geographic layout
      const { positions: geoPositions } = generateGeoPositions(
        childMarkers,
        clusterLatLng,
        map,
        CLUSTER_CONFIG.gridSpacing
      );

      // Adjust positions to avoid overlaps
      const minSpacing = CLUSTER_CONFIG.gridSpacing;
      const adjustedPositions = geoPositions.map(pos => L.point(pos.x, pos.y));

      // Multiple passes to resolve overlaps (external + siblings)
      for (let pass = 0; pass < 5; pass++) {
        for (let i = 0; i < adjustedPositions.length; i++) {
          const expandedPixel = clusterPixel.add(adjustedPositions[i]);

          // Avoid external obstacles
          for (const avoidPixel of avoidPixels) {
            const dx = expandedPixel.x - avoidPixel.x;
            const dy = expandedPixel.y - avoidPixel.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minSpacing && dist > 0) {
              const pushDist = (minSpacing - dist) / 2 + 2;
              adjustedPositions[i] = L.point(
                adjustedPositions[i].x + (dx / dist) * pushDist,
                adjustedPositions[i].y + (dy / dist) * pushDist
              );
            }
          }

          // Avoid siblings within same cluster
          for (let j = 0; j < adjustedPositions.length; j++) {
            if (i === j) continue;
            const siblingPixel = clusterPixel.add(adjustedPositions[j]);
            const currentPixel = clusterPixel.add(adjustedPositions[i]);
            const dx = currentPixel.x - siblingPixel.x;
            const dy = currentPixel.y - siblingPixel.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minSpacing && dist > 0) {
              const pushDist = (minSpacing - dist) / 2 + 2;
              adjustedPositions[i] = L.point(
                adjustedPositions[i].x + (dx / dist) * pushDist,
                adjustedPositions[i].y + (dy / dist) * pushDist
              );
            } else if (dist === 0) {
              const angle = Math.random() * Math.PI * 2;
              adjustedPositions[i] = L.point(
                adjustedPositions[i].x + Math.cos(angle) * minSpacing / 2,
                adjustedPositions[i].y + Math.sin(angle) * minSpacing / 2
              );
            }
          }
        }
      }

      const expandedMarkers: L.Marker[] = [];
      const connectionLines: L.Polyline[] = [];

      // Create collapse function for this specific cluster
      const collapseThisCluster = () => collapseOne(clusterKey);

      childMarkers.forEach((marker, index) => {
        const offset = adjustedPositions[index];
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
      setHasExpandedClusters(true);
    },
    [
      map,
      collapseOne,
      onArtistSelect,
      onArtistDeselect,
      onEditArtist,
      onDeleteArtist,
      getClusterGroup,
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

  // Track popup close to prevent cluster collapse when just deselecting artist
  useEffect(() => {
    const handlePopupClose = () => {
      popupJustClosedRef.current = true;
      // Reset flag after a short delay
      setTimeout(() => {
        popupJustClosedRef.current = false;
      }, 50);
    };

    map.on('popupclose', handlePopupClose);
    return () => {
      map.off('popupclose', handlePopupClose);
    };
  }, [map]);

  // Collapse all on map click
  useEffect(() => {
    const handleMapClick = () => {
      // don't collapse user is just deselecting - 
      if (popupJustClosedRef.current) {
        return;
      }

      if (expandedStatesRef.current.size > 0) {
        collapseAll();
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, collapseAll]);

  // Expand all visible clusters
  const expandAll = useCallback(() => {
    const clusterGroup = getClusterGroup?.();
    if (!clusterGroup) return;

    const featureGroup = (clusterGroup as unknown as { _featureGroup?: L.FeatureGroup })._featureGroup;
    if (!featureGroup) return;

    const clustersToExpand: L.MarkerCluster[] = [];
    featureGroup.eachLayer((layer) => {
      const maybeCluster = layer as L.MarkerCluster & { _childCount?: number };
      if (maybeCluster._childCount) {
        clustersToExpand.push(maybeCluster);
      }
    });

    clustersToExpand.forEach((cluster) => expandCluster(cluster));
  }, [getClusterGroup, expandCluster]);

  return {
    expandCluster,
    collapseCluster: collapseAll,
    expandAll,
    hasExpandedClusters,
  };
};
