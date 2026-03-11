import L from 'leaflet';
import type { Artist } from '../../types/artist';

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

  // Prevent double-click zoom in
  marker.on('dblclick', (e) => {
    L.DomEvent.stopPropagation(e);
  });

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