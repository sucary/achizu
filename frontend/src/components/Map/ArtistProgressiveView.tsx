import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Artist, LocationView } from '../../types/artist';
import ArtistProfile from '../ArtistProfile';
import { createArtistMarker, createDotMarker, preloadArtistImages } from '../../utils/mapUtils';
import { setupMarkerPopupEvents } from './cluster';
import { useProgressiveVisibility } from './progressive/useProgressiveVisibility';

interface ArtistProgressiveViewProps {
  artists: Artist[];
  view: LocationView;
  onArtistSelect?: (artist: Artist) => void;
  onArtistDeselect?: () => void;
  onEditArtist?: (artist: Artist) => void;
  onDeleteArtist?: (artist: Artist) => void;
}

const ArtistProgressiveView = ({
  artists,
  view,
  onArtistSelect,
  onArtistDeselect,
  onEditArtist,
  onDeleteArtist,
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
  }, [dots, view, map, onArtistSelect, onArtistDeselect, onEditArtist, onDeleteArtist]);

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

  const expandDot = (artist: Artist, dot: L.Marker) => {
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
          expandDot(artist, newDot);
        });
        dotLayerRef.current.addLayer(newDot);
      }
    });

    // Track expanded state
    expandedRef.current.set(artist.id, { marker, dot });

    marker.addTo(map);
    marker.openPopup();
  };

  return null;
};

export default ArtistProgressiveView;
