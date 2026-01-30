import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
// @ts-ignore
import * as LMarkerCluster from 'leaflet.markercluster';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Artist, LocationView } from '../../types/artist';
import ArtistProfile from '../ArtistProfile';
import { createArtistMarker } from '../../utils/mapUtils';

interface ArtistClusterProps {
    artists: Artist[];
    view: LocationView;
    onArtistSelect?: (artist: Artist) => void;
    onArtistDeselect?: () => void;
    onEditArtist?: (artist: Artist) => void;
    onDeleteArtist?: (artist: Artist) => void;
}

const ArtistCluster = ({ artists, view, onArtistSelect, onArtistDeselect, onEditArtist, onDeleteArtist }: ArtistClusterProps) => {
  const map = useMap();


  useEffect(() => {
    // Distance basedd clustering
    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 100,
      disableClusteringAtZoom: 9, // The map has 0-20 zooming levels by default
      
      // Styling for the cluster icons
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="flex items-center justify-center w-8 h-8 bg-black text-white rounded-full font-bold border-2 border-white shadow-lg">${count}</div>`,
          className: 'custom-cluster-marker',
          iconSize: [32, 32],
        });
      }
    });

    artists.forEach((artist) => {
      const icon = createArtistMarker(artist);
      const location = view === 'active' ? artist.activeLocation : artist.originalLocation;
      const marker = L.marker(
        [location.coordinates.lat, location.coordinates.lng], 
        { icon }
      );
      
      // Bind the popup
      const popupContent = renderToStaticMarkup(<ArtistProfile artist={artist} />);
      marker.bindPopup(popupContent, {
          className: 'artist-popup',
          closeButton: false,
          minWidth: 320
      });

      marker.on('popupopen', (e) => {
          if (onArtistSelect) {
              onArtistSelect(artist);
          }

          // Click handler for edit/delete buttons via event delegation
          const popupElement = e.popup.getElement();
          if (popupElement) {
              const handleActionClick = (event: Event) => {
                  const target = event.target as HTMLElement;
                  const editButton = target.closest('[data-action="edit"]');
                  const deleteButton = target.closest('[data-action="delete"]');

                  if (editButton && onEditArtist) {
                      event.preventDefault();
                      event.stopPropagation();
                      map.closePopup();
                      onEditArtist(artist);
                  } else if (deleteButton && onDeleteArtist) {
                      event.preventDefault();
                      event.stopPropagation();
                      map.closePopup();
                      onDeleteArtist(artist);
                  }
              };
              popupElement.addEventListener('click', handleActionClick);
          }
      });

      marker.on('popupclose', () => {
          if (onArtistDeselect) {
              onArtistDeselect();
          }
      });

      markerClusterGroup.addLayer(marker);
    });

    map.addLayer(markerClusterGroup);

    return () => {
      map.removeLayer(markerClusterGroup);
    };
  }, [map, artists, view, onArtistSelect, onArtistDeselect, onEditArtist, onDeleteArtist]);

  return null;
};

export default ArtistCluster;