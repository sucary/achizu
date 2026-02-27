import { useState, useEffect, useCallback, useRef } from 'react';
import type L from 'leaflet';
import type { Artist, LocationView } from '../../../types/artist';
import { PROGRESSIVE_CONFIG } from './progressiveConstants';

interface VisibilityResult {
  markers: Artist[];
  dots: Artist[];
  hidden: Artist[];
}

// Simple string hash to number for deterministic sorting
const hashArtistId = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

const getArtistCoords = (artist: Artist, view: LocationView) => {
  const location = view === 'active' ? artist.activeLocation : artist.originalLocation;
  return location.coordinates;
};

const calculateVisibility = (
  artists: Artist[],
  map: L.Map,
  view: LocationView,
): VisibilityResult => {
  if (artists.length === 0) {
    return { markers: [], dots: [], hidden: [] };
  }

  const zoom = map.getZoom();
  const minDistance = Math.max(
    PROGRESSIVE_CONFIG.minDistanceFloor,
    PROGRESSIVE_CONFIG.minDistanceBase * Math.pow(PROGRESSIVE_CONFIG.zoomDistanceFactor, zoom),
  );

  // Sort by stable hash for deterministic priority
  const sorted = [...artists].sort((a, b) => hashArtistId(a.id) - hashArtistId(b.id));

  // Convert to pixel positions
  const pixelPositions = sorted.map((artist) => {
    const coords = getArtistCoords(artist, view);
    return map.latLngToLayerPoint([coords.lat, coords.lng]);
  });

  const markers: Artist[] = [];
  const markerPixels: L.Point[] = [];
  const dots: Artist[] = [];
  const dotPixels: L.Point[] = [];
  const remaining: number[] = [];

  // Select markers: walk sorted list, distance-spread filter
  for (let i = 0; i < sorted.length; i++) {
    if (markers.length >= PROGRESSIVE_CONFIG.maxMarkers) {
      remaining.push(i);
      continue;
    }

    const px = pixelPositions[i];
    let tooClose = false;
    for (const mp of markerPixels) {
      if (px.distanceTo(mp) < minDistance) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      markers.push(sorted[i]);
      markerPixels.push(px);
    } else {
      remaining.push(i);
    }
  }

  // Select dots from remaining, distance-spread against markers AND other dots
  for (const idx of remaining) {
    if (dots.length >= PROGRESSIVE_CONFIG.maxDots) break;

    const px = pixelPositions[idx];
    let tooClose = false;

    // Check against markers
    for (const mp of markerPixels) {
      if (px.distanceTo(mp) < minDistance * 0.5) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      // Check against other dots
      for (const dp of dotPixels) {
        if (px.distanceTo(dp) < minDistance * 0.3) {
          tooClose = true;
          break;
        }
      }
    }

    if (!tooClose) {
      dots.push(sorted[idx]);
      dotPixels.push(px);
    }
  }

  // Everything else is hidden
  const markerIds = new Set(markers.map((a) => a.id));
  const dotIds = new Set(dots.map((a) => a.id));
  const hidden = sorted.filter((a) => !markerIds.has(a.id) && !dotIds.has(a.id));

  console.log(`[Progressive] minDistance: ${minDistance.toFixed(1)}px, markers: ${markers.length}, dots: ${dots.length}, hidden: ${hidden.length}`);
  return { markers, dots, hidden };
};

export const useProgressiveVisibility = (
  artists: Artist[],
  map: L.Map | null,
  view: LocationView,
): VisibilityResult => {
  const [result, setResult] = useState<VisibilityResult>({ markers: [], dots: [], hidden: [] });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recalculate = useCallback(() => {
    if (!map || artists.length === 0) {
      setResult({ markers: [], dots: [], hidden: [] });
      return;
    }
    setResult(calculateVisibility(artists, map, view));
  }, [artists, map, view]);

  const debouncedRecalculate = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      recalculate();
      debounceRef.current = null;
    }, PROGRESSIVE_CONFIG.recalcDebounceMs);
  }, [recalculate]);

  // Recalculate on mount and when artists/view change
  useEffect(() => {
    recalculate();
  }, [recalculate]);

  // Listen to zoomend
  useEffect(() => {
    if (!map) return;

    map.on('zoomend', debouncedRecalculate);
    return () => {
      map.off('zoomend', debouncedRecalculate);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [map, debouncedRecalculate]);

  return result;
};
