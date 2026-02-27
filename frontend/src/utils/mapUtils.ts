import L from 'leaflet';
import type { Artist } from '../types/artist';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { getAvatarUrl } from './cloudinaryUrl';

// Initialize default marker icon
const DefaultMarker = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultMarker;

// Placeholder img
const getPlaceholderUrl = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=150&background=e5e7eb&color=9ca3af`;

// Preload artist avatar images in batch into browser cache
export const preloadArtistImages = (artists: Artist[], batchSize = 10, delayMs = 100) => {
  const urls = artists.map(
    (artist) => getAvatarUrl(artist.sourceImage, artist.avatarCrop) || getPlaceholderUrl(artist.name)
  );

  let index = 0;
  const loadBatch = () => {
    const batch = urls.slice(index, index + batchSize);
    batch.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
    index += batchSize;
    if (index < urls.length) {
      setTimeout(loadBatch, delayMs);
    }
  };

  loadBatch();
};

// Turn an artist profile into a Leaflet div icon
export const createArtistMarker = (artist: Artist) => {
  // Use Cloudinary transformation to get avatar image
  const imageUrl = getAvatarUrl(artist.sourceImage, artist.avatarCrop) || getPlaceholderUrl(artist.name);
  const iconHtml = `
    <div class="relative w-7 h-7 rounded-full border-2 border-white shadow-lg overflow-hidden bg-gray-200 group">
      <img
        src="${imageUrl}"
        class="w-full h-full object-cover object-center"
        alt="${artist.name}"
      />
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'custom-artist-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

export const createDotMarker = () => {
  return L.divIcon({
    html: '<div style="width:10px;height:10px;border-radius:50%;background:var(--color-primary);"></div>',
    className: 'artist-dot-marker',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
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