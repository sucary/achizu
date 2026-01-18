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

const ArtistCluster = ({ artists, view }: { artists: Artist[] ; view: LocationView }) => {
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
      
      markerClusterGroup.addLayer(marker);
    });

    map.addLayer(markerClusterGroup);

    return () => {
      map.removeLayer(markerClusterGroup);
    };
  }, [map, artists, view]);

  return null;
};

export default ArtistCluster;