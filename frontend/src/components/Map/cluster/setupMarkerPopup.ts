import L from 'leaflet';
import type { Artist } from '../../../types/artist';

export interface PopupEventHandlers {
  onArtistSelect?: (artist: Artist) => void;
  onArtistDeselect?: () => void;
  onEditArtist?: (artist: Artist) => void;
  onDeleteArtist?: (artist: Artist) => void;
}

export interface SetupPopupOptions extends PopupEventHandlers {
  map: L.Map;
  marker: L.Marker;
  artist: Artist;
  onBeforeAction?: () => void;
}

/**
 * Sets up popup event handlers for a marker.
 * Handles artist selection/deselection and edit/delete button clicks.
 */
export const setupMarkerPopupEvents = ({
  map,
  marker,
  artist,
  onArtistSelect,
  onArtistDeselect,
  onEditArtist,
  onDeleteArtist,
  onBeforeAction,
}: SetupPopupOptions): void => {
  let currentClickHandler: ((event: Event) => void) | null = null;

  marker.on('popupopen', (e) => {
    const markerElement = marker.getElement();
    if (markerElement) {
      markerElement.classList.add('marker-focused');
    }

    if (onArtistSelect) {
      onArtistSelect(artist);
    }

    // Click handler for edit/delete buttons via event delegation
    const popupElement = e.popup.getElement();
    if (popupElement) {
      // Remove previous handler if exists
      if (currentClickHandler) {
        popupElement.removeEventListener('click', currentClickHandler);
      }

      currentClickHandler = (event: Event) => {
        const target = event.target as HTMLElement;
        const editButton = target.closest('[data-action="edit"]');
        const deleteButton = target.closest('[data-action="delete"]');

        if (editButton && onEditArtist) {
          event.preventDefault();
          event.stopPropagation();
          map.closePopup();
          onBeforeAction?.();
          onEditArtist(artist);
        } else if (deleteButton && onDeleteArtist) {
          event.preventDefault();
          event.stopPropagation();
          map.closePopup();
          onBeforeAction?.();
          onDeleteArtist(artist);
        }
      };
      popupElement.addEventListener('click', currentClickHandler);
    }
  });

  marker.on('popupclose', (e) => {
    const markerElement = marker.getElement();
    if (markerElement) {
      markerElement.classList.remove('marker-focused');
    }

    // Clean up click handler
    const popupElement = e.popup?.getElement();
    if (popupElement && currentClickHandler) {
      popupElement.removeEventListener('click', currentClickHandler);
      currentClickHandler = null;
    }

    if (onArtistDeselect) {
      onArtistDeselect();
    }
  });
};

/**
 * Creates the collapse button marker for expanded clusters.
 */
export const createCollapseButton = (
  latLng: L.LatLng,
  onCollapse: () => void
): L.Marker => {
  const collapseIcon = L.divIcon({
    html: `<div class="flex items-center justify-center w-6 h-6 bg-surface text-text rounded-full font-bold border border-text shadow-lg cursor-pointer hover:bg-surface-muted text-sm">×</div>`,
    className: 'cluster-center-marker expanded-cluster-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const marker = L.marker(latLng, { icon: collapseIcon });
  marker.on('click', onCollapse);

  return marker;
};
