import { useCallback, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Artist, LocationView } from '../../types/artist';
import ArtistProfile from '../ArtistProfile';
import { createArtistMarker, createDotMarker, preloadArtistImages } from '../../utils/mapUtils';
import { setupMarkerPopupEvents } from './cluster';
import { useProgressiveVisibility } from '../../hooks/useProgressiveVisibility';

interface ArtistProgressiveViewProps {
  artists: Artist[];
  view: LocationView;
  onArtistSelect?: (artist: Artist) => void;
  onArtistDeselect?: () => void;
  onEditArtist?: (artist: Artist) => void;
  onDeleteArtist?: (artist: Artist) => void;
  focusedArtist?: Artist | null;
  onFocusedArtistHandled?: () => void;
}

const ArtistProgressiveView = ({
  artists,
  view,
  onArtistSelect,
  onArtistDeselect,
  onEditArtist,
  onDeleteArtist,
  focusedArtist,
  onFocusedArtistHandled,
}: ArtistProgressiveViewProps) => {
  const map = useMap();
  const markerLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const dotLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const expandedRef = useRef<Map<string, { marker: L.Marker; dot: L.Marker }>>(new Map());

  const { markers, dots } = useProgressiveVisibility(artists, map, view);
  const markersRef = useRef(markers);
  const dotsRef = useRef(dots);
  markersRef.current = markers;
  dotsRef.current = dots;

  useEffect(() => {
    preloadArtistImages(artists);
  }, [artists]);

  // Add layers to map on mount
  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    const dotLayer = dotLayerRef.current;
    dotLayer.addTo(map);
    markerLayer.addTo(map);

    return () => {
      markerLayer.removeFrom(map);
      dotLayer.removeFrom(map);
    };
  }, [map]);

  // Render full markers
  useEffect(() => {
    const layer = markerLayerRef.current;
    layer.clearLayers();

    markers.forEach((artist) => {

      if (expandedRef.current.has(artist.id)) return;

      const icon = createArtistMarker(artist);
      const location = view === 'active' ? artist.activeLocation : artist.originalLocation;
      const marker = L.marker(
        [location.coordinates.lat, location.coordinates.lng],
        { icon, zIndexOffset: 1000 },
      );

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

      layer.addLayer(marker);
    });
  }, [markers, view, map, onArtistSelect, onArtistDeselect, onEditArtist, onDeleteArtist]);

  // Store expandDot function to avoid circular dependency
  const expandDotRef = useRef<((artist: Artist, dot: L.Marker) => void) | null>(null);

  // Function to expand a dot into a full marker with popup
  const expandDot = useCallback((artist: Artist, dot: L.Marker) => {
    // Remove the dot from its layer
    dotLayerRef.current.removeLayer(dot);

    // Create full marker
    const icon = createArtistMarker(artist);
    const location = view === 'active' ? artist.activeLocation : artist.originalLocation;
    const marker = L.marker(
      [location.coordinates.lat, location.coordinates.lng],
      { icon },
    );

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
      onArtistDeselect: () => {
        onArtistDeselect?.();
      },
      onEditArtist,
      onDeleteArtist,
    });

    // On popup close, collapse back to dot, unless promoted to marker by zoom
    marker.on('popupclose', () => {
      // Check if this artist is now a full marker
      const isNowMarker = markersRef.current.some((m) => m.id === artist.id);
      if (isNowMarker) {
        map.removeLayer(marker);
        expandedRef.current.delete(artist.id);
        return;
      }

      // Restore as dot
      map.removeLayer(marker);
      expandedRef.current.delete(artist.id);

      // Check if still a dot at current zoom
      const isStillDot = dotsRef.current.some((d) => d.id === artist.id);
      if (isStillDot) {
        const newDot = L.marker(
          [location.coordinates.lat, location.coordinates.lng],
          { icon: createDotMarker() },
        );
        newDot.on('click', () => {
          expandDotRef.current?.(artist, newDot);
        });
        dotLayerRef.current.addLayer(newDot);
      }
    });

    // Track expanded state
    expandedRef.current.set(artist.id, { marker, dot });

    marker.addTo(map);
    marker.openPopup();
  }, [view, map, onArtistSelect, onArtistDeselect, onEditArtist, onDeleteArtist]);

  // Keep ref up to date
  useEffect(() => {
    expandDotRef.current = expandDot;
  }, [expandDot]);

  // Render dots
  useEffect(() => {
    const layer = dotLayerRef.current;
    layer.clearLayers();

    dots.forEach((artist) => {

      if (expandedRef.current.has(artist.id)) return;

      const location = view === 'active' ? artist.activeLocation : artist.originalLocation;
      const dot = L.marker(
        [location.coordinates.lat, location.coordinates.lng],
        { icon: createDotMarker(), zIndexOffset: 0 },
      );

      dot.on('click', () => {
        expandDot(artist, dot);
      });

      layer.addLayer(dot);
    });
  }, [dots, view, expandDot]);

  // Clean up expanded markers that are no longer in the artist list
  useEffect(() => {
    const currentIds = new Set(artists.map((a) => a.id));
    for (const [id, { marker }] of expandedRef.current) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        expandedRef.current.delete(id);
      }
    }
  }, [artists, map]);

  // Handle focused artist
  useEffect(() => {
    if (!focusedArtist) return;

    const artistId = focusedArtist.id;
    const location = view === 'active'
      ? focusedArtist.activeLocation
      : focusedArtist.originalLocation;

    map.flyTo([location.coordinates.lat, location.coordinates.lng], 11, {
      duration: 2,
    });

    // Find and expand the artist after fly animation
    setTimeout(() => {
      // Check if already expanded
      const expanded = expandedRef.current.get(artistId);
      if (expanded) {
        expanded.marker.openPopup();
        onArtistSelect?.(focusedArtist);
      } else {
        const artist = artists.find(a => a.id === artistId);
        if (artist) {
          // Find if it's a dot or marker and expand/open it
          const artistLocation = view === 'active' ? artist.activeLocation : artist.originalLocation;

          // Create and show the marker with popup
          const icon = createArtistMarker(artist);
          const marker = L.marker(
            [artistLocation.coordinates.lat, artistLocation.coordinates.lng],
            { icon },
          );

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

          marker.addTo(map);
          marker.openPopup();
          onArtistSelect?.(artist);

          marker.on('popupclose', () => {
            map.removeLayer(marker);
          });
        }
      }
      onFocusedArtistHandled?.();
    }, 2100);
  }, [focusedArtist, map, view, artists, onArtistSelect, onArtistDeselect, onEditArtist, onDeleteArtist, onFocusedArtistHandled]);

  return null;
};

export default ArtistProgressiveView;
