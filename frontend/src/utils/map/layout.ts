import L from 'leaflet';
import { CLUSTER_CONFIG } from '../../constants/mapCluster';

/**
 * Generate positions that preserve the geographic layout of markers
 * relative to their cluster center, scaled to fit a readable pixel radius.
 */
export const generateGeoPositions = (
  markers: L.Marker[],
  clusterCenter: L.LatLng,
  map: L.Map,
  minSpacing: number = CLUSTER_CONFIG.gridSpacing
): { positions: L.Point[] } => {
  if (markers.length === 0) {
    return { positions: [] };
  }

  if (markers.length === 1) {
    return { positions: [L.point(0, 0)] };
  }

  const centerPixel = map.latLngToLayerPoint(clusterCenter);

  // Get each marker's pixel offset from the cluster center
  const rawOffsets = markers.map((marker) => {
    const markerPixel = map.latLngToLayerPoint(marker.getLatLng());
    return L.point(markerPixel.x - centerPixel.x, markerPixel.y - centerPixel.y);
  });

  // Find the max distance from center and scale to target radius
  const maxDist = Math.max(...rawOffsets.map((p) => Math.sqrt(p.x * p.x + p.y * p.y)), 1);
  const targetRadius = Math.max(minSpacing * 1.5, Math.sqrt(markers.length) * minSpacing);
  const scale = targetRadius / maxDist;

  const positions = rawOffsets.map((offset) => L.point(offset.x * scale, offset.y * scale));

  return { positions };
};
