import { ArtistStore } from '../models/artistStore';
import { CityService } from './cityService';
import { CreateArtistDTO, UpdateArtistDTO, Artist, StoreArtistDTO, UpdateStoreArtistDTO } from '../types/artist';

export const ArtistService = {
    getAll: async () => {
        return await ArtistStore.getAll();
    },

    getById: async (id: string) => {
        return await ArtistStore.getById(id);
    },

    create: async (data: CreateArtistDTO): Promise<Artist> => {
        // 1. Check if cities exist and get their IDs
        const originalCity = await CityService.getCity(
            data.originalLocation.city,
            data.originalLocation.province
        );

        const activeCity = await CityService.getCity(
            data.activeLocation.city,
            data.activeLocation.province
        );

        // 2. Generate random display coordinates for both locations
        // Fallback to the provided center if generation fails
        const [originalRandomPoint, activeRandomPoint] = await Promise.all([
            CityService.generateRandomPoint(originalCity.id),
            CityService.generateRandomPoint(activeCity.id)
        ]);

        const originalDisplayCoordinates = originalRandomPoint || data.originalLocation.coordinates;
        const activeDisplayCoordinates = activeRandomPoint || data.activeLocation.coordinates;

        // 3. Prepare data for Store
        const storeData: StoreArtistDTO = {
            ...data,
            originalCityId: originalCity.id,
            activeCityId: activeCity.id,
            originalLocationDisplayCoordinates: originalDisplayCoordinates,
            activeLocationDisplayCoordinates: activeDisplayCoordinates
        };

        // 4. Create artist
        return await ArtistStore.create(storeData);
    },

    update: async (id: string, data: UpdateArtistDTO): Promise<Artist | undefined> => {
        const storeData: UpdateStoreArtistDTO = { ...data };

        // If locations are being updated, resolve new IDs
        if (data.originalLocation) {
            const city = await CityService.getCity(
                data.originalLocation.city,
                data.originalLocation.province
            );
            storeData.originalCityId = city.id;

            // Regenerate display coordinates if original location changes
            const randomPoint = await CityService.generateRandomPoint(city.id);
            storeData.originalLocationDisplayCoordinates = randomPoint || data.originalLocation.coordinates;
        }

        if (data.activeLocation) {
            const city = await CityService.getCity(
                data.activeLocation.city,
                data.activeLocation.province
            );
            storeData.activeCityId = city.id;

            // Regenerate display coordinates if active location changes
            const randomPoint = await CityService.generateRandomPoint(city.id);
            storeData.activeLocationDisplayCoordinates = randomPoint || data.activeLocation.coordinates;
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