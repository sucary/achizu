import { ArtistStore } from '../models/artistStore';
import { CityService } from './cityService';
import { CreateArtistDTO, UpdateArtistDTO, Artist, StoreArtistDTO, UpdateStoreArtistDTO, ArtistQueryParams } from '../types/artist';

export const ArtistService = {
    getAll: async (params: ArtistQueryParams) => {
        return await ArtistStore.getAll(params);
    },

    getById: async (id: string) => {
        return await ArtistStore.getById(id);
    },

    create: async (data: CreateArtistDTO): Promise<Artist> => {
        let originalCity, activeCity;

        // 1. Handle original location - support both OSM ID and city name + province
        if (data.originalLocation.osmId && data.originalLocation.osmType) {
            originalCity = await CityService.getByOsmId(
                data.originalLocation.osmId,
                data.originalLocation.osmType
            );

            if (!originalCity) {
                const nominatimData = await CityService.fetchByOsmId(
                    data.originalLocation.osmId,
                    data.originalLocation.osmType
                );
                if (!nominatimData) {
                    throw new Error('Failed to fetch original city data from Nominatim');
                }
                originalCity = await CityService.saveFromNominatim(nominatimData);
            }
        } else {
            // （old) city name + province for testing/seeding
            originalCity = await CityService.getCity(
                data.originalLocation.city,
                data.originalLocation.province
            );
        }

        // 2. Handle active location
        if (data.activeLocation.osmId && data.activeLocation.osmType) {
            activeCity = await CityService.getByOsmId(
                data.activeLocation.osmId,
                data.activeLocation.osmType
            );

            if (!activeCity) {
                const nominatimData = await CityService.fetchByOsmId(
                    data.activeLocation.osmId,
                    data.activeLocation.osmType
                );
                if (!nominatimData) {
                    throw new Error('Failed to fetch active city data from Nominatim');
                }
                activeCity = await CityService.saveFromNominatim(nominatimData);
            }
        } else {
            // （old) city name + province for testing/seeding
            activeCity = await CityService.getCity(
                data.activeLocation.city,
                data.activeLocation.province
            );
        }

        // 3. Enforce Nominatim city centers
        // Overwrite the provided coordinates with Nominatim coordinates
        data.originalLocation.coordinates = originalCity.center;
        data.activeLocation.coordinates = activeCity.center;

        // 4. Generate random display coordinates for both locations
        // - If both cities are the same, use the same random point
        // Fallback to the official center if generation fails
        let originalDisplayCoordinates, activeDisplayCoordinates;

        if (originalCity.id === activeCity.id) {
            // Same city - use one random point for both
            const randomPoint = await CityService.generateRandomPoint(originalCity.id);
            const displayCoord = randomPoint || originalCity.center;
            originalDisplayCoordinates = displayCoord;
            activeDisplayCoordinates = displayCoord;
        } else {
            // Different cities - generate separate random points
            const [originalRandomPoint, activeRandomPoint] = await Promise.all([
                CityService.generateRandomPoint(originalCity.id),
                CityService.generateRandomPoint(activeCity.id)
            ]);
            originalDisplayCoordinates = originalRandomPoint || originalCity.center;
            activeDisplayCoordinates = activeRandomPoint || activeCity.center;
        }

        // 5. Prepare data for Store
        const storeData: StoreArtistDTO = {
            ...data,
            originalCityId: originalCity.id,
            activeCityId: activeCity.id,
            originalLocationDisplayCoordinates: originalDisplayCoordinates,
            activeLocationDisplayCoordinates: activeDisplayCoordinates
        };

        // 6. Create artist
        return await ArtistStore.create(storeData);
    },

    update: async (id: string, data: UpdateArtistDTO): Promise<Artist | undefined> => {
        const storeData: UpdateStoreArtistDTO = { ...data };

        // Fetch current artist to check city IDs
        const currentArtist = await ArtistStore.getById(id);
        if (!currentArtist) {
            return undefined;
        }

        let finalOriginalCityId = currentArtist.originalCityId;
        let finalActiveCityId = currentArtist.activeCityId;

        // If locations are being updated, resolve new IDs
        if (data.originalLocation) {
            let city;
            if (data.originalLocation.osmId && data.originalLocation.osmType) {
                city = await CityService.getByOsmId(
                    data.originalLocation.osmId,
                    data.originalLocation.osmType
                );

                if (!city) {
                    const nominatimData = await CityService.fetchByOsmId(
                        data.originalLocation.osmId,
                        data.originalLocation.osmType
                    );
                    if (!nominatimData) {
                        throw new Error('Failed to fetch original city data from Nominatim');
                    }
                    city = await CityService.saveFromNominatim(nominatimData);
                }
            } else {
                // （old) city name + province
                city = await CityService.getCity(
                    data.originalLocation.city,
                    data.originalLocation.province
                );
            }
            storeData.originalCityId = city.id;
            finalOriginalCityId = city.id;
        }

        if (data.activeLocation) {
            let city;
            if (data.activeLocation.osmId && data.activeLocation.osmType) {
                city = await CityService.getByOsmId(
                    data.activeLocation.osmId,
                    data.activeLocation.osmType
                );

                if (!city) {
                    const nominatimData = await CityService.fetchByOsmId(
                        data.activeLocation.osmId,
                        data.activeLocation.osmType
                    );
                    if (!nominatimData) {
                        throw new Error('Failed to fetch active city data from Nominatim');
                    }
                    city = await CityService.saveFromNominatim(nominatimData);
                }
            } else {
                // （old) city name + province
                city = await CityService.getCity(
                    data.activeLocation.city,
                    data.activeLocation.province
                );
            }
            storeData.activeCityId = city.id;
            finalActiveCityId = city.id;
        }

        // Check if final state has both cities the same
        if (finalOriginalCityId === finalActiveCityId) {
            // Same city - use the same random point for both to prevent "jumping"
            const randomPoint = await CityService.generateRandomPoint(finalOriginalCityId);
            const displayCoord = randomPoint || (data.originalLocation?.coordinates || data.activeLocation?.coordinates);

            // Only update the coordinates that were modified
            if (data.originalLocation) {
                storeData.originalLocationDisplayCoordinates = displayCoord;
            }
            if (data.activeLocation) {
                storeData.activeLocationDisplayCoordinates = displayCoord;
            }

            // If one location was updated to match the other, update both display coords
            if (data.originalLocation && !data.activeLocation) {
                storeData.activeLocationDisplayCoordinates = displayCoord;
            } else if (data.activeLocation && !data.originalLocation) {
                storeData.originalLocationDisplayCoordinates = displayCoord;
            }
        } else {
            // Different cities - generate separate random points for the new city
            if (data.originalLocation) {
                const randomPoint = await CityService.generateRandomPoint(finalOriginalCityId);
                storeData.originalLocationDisplayCoordinates = randomPoint || data.originalLocation.coordinates;
            }

            if (data.activeLocation) {
                const randomPoint = await CityService.generateRandomPoint(finalActiveCityId);
                storeData.activeLocationDisplayCoordinates = randomPoint || data.activeLocation.coordinates;
            }
        }

        return await ArtistStore.update(id, storeData);
    },

    delete: async (id: string) => {
        return await ArtistStore.delete(id);
    },

    countByCity: async (view: 'original' | 'active' = 'active') => {
        return await ArtistStore.countByCity(view);
    }
};