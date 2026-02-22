import L from 'leaflet';
import { CLUSTER_CONFIG } from './clusterConstants';

// Generates the visual cluster icons.

interface ClusterIconOptions {
  map: L.Map;
}


const calculateGeometricBounds = (markers: L.Marker[]) => {
  let minLat = Infinity,
    maxLat = -Infinity;
  let minLng = Infinity,
    maxLng = -Infinity;

  markers.forEach((marker) => {
    const pos = marker.getLatLng();
    minLat = Math.min(minLat, pos.lat);
    maxLat = Math.max(maxLat, pos.lat);
    minLng = Math.min(minLng, pos.lng);
    maxLng = Math.max(maxLng, pos.lng);
  });

  return {
    center: L.latLng((minLat + maxLat) / 2, (minLng + maxLng) / 2),
    bounds: { minLat, maxLat, minLng, maxLng },
  };
};

const generateHueFromCoordinates = (latLng: L.LatLng): number => {
  // Pseudo-random distribution from coordinates for color variety
  const hash = Math.sin(latLng.lat * 1234.5) * Math.cos(latLng.lng * 5678.9) * 10000;
  return Math.abs(hash % 360);
};

export const createClusterIconFactory = ({ map }: ClusterIconOptions) => {
  return (cluster: L.MarkerCluster): L.DivIcon => {
    const count = cluster.getChildCount();
    const childMarkers = cluster.getAllChildMarkers() as L.Marker[];

    const weightedLatLng = cluster.getLatLng();
    const weightedPixel = map.latLngToLayerPoint(weightedLatLng);

    const { center: geometricLatLng } = calculateGeometricBounds(childMarkers);
    const geometricPixel = map.latLngToLayerPoint(geometricLatLng);

    // Calculate size: max distance from geometric center to any marker
    let maxDistance = 0;
    childMarkers.forEach((marker) => {
      const markerPixel = map.latLngToLayerPoint(marker.getLatLng());
      const distance = geometricPixel.distanceTo(markerPixel);
      maxDistance = Math.max(maxDistance, distance);
    });

    const size = Math.min(
      CLUSTER_CONFIG.maxClusterSize,
      Math.max(CLUSTER_CONFIG.minClusterSize, maxDistance * 2 + 20)
    );

    // Offset: shift towards geometric center using CSS transform
    let offsetX = geometricPixel.x - weightedPixel.x;
    let offsetY = geometricPixel.y - weightedPixel.y;

    // Clamp to prevent wild shifts (max based on size)
    const maxOffset = size * CLUSTER_CONFIG.maxOffsetRatio;
    offsetX = Math.max(-maxOffset, Math.min(maxOffset, offsetX));
    offsetY = Math.max(-maxOffset, Math.min(maxOffset, offsetY));

    // Color using geometric center as seed
    const hue = generateHueFromCoordinates(geometricLatLng);

    // Scale saturation and lightness based on artist count
    // More artists = more saturated (30-70%) and darker (50-30%)
    const countFactor = Math.min(1, count / 10);
    const saturation = 30 + countFactor * 40;
    const lightness = 50 - countFactor * 20;

    const color = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.4)`;
    const borderColor = `hsla(${hue}, ${saturation}%, ${lightness - 10}%, 0.6)`;

    const fontSize = Math.max(12, Math.min(28, size / 5));

    return L.divIcon({
      html: `<div class="flex items-center justify-center rounded-full font-bold border-2 shadow-lg cursor-pointer text-white" style="width: ${size}px; height: ${size}px; background: ${color}; border-color: ${borderColor}; font-size: ${fontSize}px; transform: translate(${offsetX}px, ${offsetY}px);">${count}</div>`,
      className: 'custom-cluster-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };
};
