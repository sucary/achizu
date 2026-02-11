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

    create: async (data: CreateArtistDTO, userId: string): Promise<Artist> => {
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

        // 3. Determine if coordinates were manually selected
        // If provided coordinates differ from city center, they were manually selected
        const originalIsManualSelection = data.originalLocation.coordinates &&
            (Math.abs(data.originalLocation.coordinates.lat - originalCity.center.lat) > 0.0001 ||
             Math.abs(data.originalLocation.coordinates.lng - originalCity.center.lng) > 0.0001);

        const activeIsManualSelection = data.activeLocation.coordinates &&
            (Math.abs(data.activeLocation.coordinates.lat - activeCity.center.lat) > 0.0001 ||
             Math.abs(data.activeLocation.coordinates.lng - activeCity.center.lng) > 0.0001);

        // 4. Set coordinates and display coordinates based on selection method
        let originalDisplayCoordinates, activeDisplayCoordinates;

        if (originalIsManualSelection) {
            // Manual selection
            originalDisplayCoordinates = data.originalLocation.coordinates;
        } else {
            // Search-based selection
            data.originalLocation.coordinates = originalCity.center;
            const randomPoint = await CityService.generateRandomPoint(originalCity.id);
            originalDisplayCoordinates = randomPoint || originalCity.center;
        }

        if (activeIsManualSelection) {
            // Manual selection
            activeDisplayCoordinates = data.activeLocation.coordinates;
        } else {
            // Search-based selection
            data.activeLocation.coordinates = activeCity.center;
            const randomPoint = await CityService.generateRandomPoint(activeCity.id);
            activeDisplayCoordinates = randomPoint || activeCity.center;
        }

        // 5. Prepare data for Store
        const storeData: StoreArtistDTO = {
            ...data,
            userId,
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
        let originalCity, activeCity;

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
            originalCity = city;
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
            activeCity = city;
            storeData.activeCityId = city.id;
            finalActiveCityId = city.id;
        }

        // Determine if coordinates were manually selected for updated locations
        const originalIsManualSelection = data.originalLocation && originalCity &&
            data.originalLocation.coordinates &&
            (Math.abs(data.originalLocation.coordinates.lat - originalCity.center.lat) > 0.0001 ||
             Math.abs(data.originalLocation.coordinates.lng - originalCity.center.lng) > 0.0001);

        const activeIsManualSelection = data.activeLocation && activeCity &&
            data.activeLocation.coordinates &&
            (Math.abs(data.activeLocation.coordinates.lat - activeCity.center.lat) > 0.0001 ||
             Math.abs(data.activeLocation.coordinates.lng - activeCity.center.lng) > 0.0001);

        // Handle display coordinates based on selection method
        if (data.originalLocation) {
            if (originalIsManualSelection) {
                // Manual selection
                storeData.originalLocationDisplayCoordinates = data.originalLocation.coordinates;
            } else {
                // Search-based selection
                data.originalLocation.coordinates = originalCity!.center;
                const randomPoint = await CityService.generateRandomPoint(finalOriginalCityId);
                storeData.originalLocationDisplayCoordinates = randomPoint || originalCity!.center;
            }
        }

        if (data.activeLocation) {
            if (activeIsManualSelection) {
                // Manual selection
                storeData.activeLocationDisplayCoordinates = data.activeLocation.coordinates;
            } else {
                // Search-based selection
                data.activeLocation.coordinates = activeCity!.center;
                const randomPoint = await CityService.generateRandomPoint(finalActiveCityId);
                storeData.activeLocationDisplayCoordinates = randomPoint || activeCity!.center;
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