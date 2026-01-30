import L from 'leaflet';
import type { Artist } from '../types/artist';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Initialize default marker icon
const DefaultMarker = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultMarker;

// Turn an artist profile into a Leaflet div icon
export const createArtistMarker = (artist: Artist) => {
  const imageUrl = artist.profilePicture || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=150&h=150';
  const iconHtml = `
    <div class="relative w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden bg-gray-200 group">
      <img 
        src="${imageUrl}" 
        class="w-full h-full object-cover"
        alt="${artist.name}"
      />
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'custom-artist-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

  export const getDisplayArtists = (_filters: {}, _view: string, artists: Artist[]) => {
      return artists.map(artist => ({
          ...artist,
          activeLocation: {
              ...artist.activeLocation,
              coordinates: artist.activeLocationDisplayCoordinates
          },
          originalLocation: {
              ...artist.originalLocation,
              coordinates: artist.originalLocationDisplayCoordinates
          }
      }));
  };