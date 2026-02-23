import { z } from 'zod';

export const CoordinatesSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});

export const LocationSchema = z.object({
    city: z.string().min(1, "City is required"),
    province: z.string().min(1, "Province is required"),
    coordinates: CoordinatesSchema,
    osmId: z.number().optional(),
    osmType: z.string().optional(),
});

export const SocialLinksSchema = z.object({
    instagram: z.string().optional().or(z.literal('')),
    twitter: z.string().optional().or(z.literal('')),
    appleMusic: z.string().optional().or(z.literal('')),
    website: z.string().optional().or(z.literal('')),
    youtube: z.string().optional().or(z.literal('')),
});

export const CropAreaSchema = z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
});

export const ArtistInputSchema = z.object({
    name: z.string().min(1, "Name is required"),
    sourceImage: z.string().optional(),
    avatarCrop: CropAreaSchema.optional(),
    profileCrop: CropAreaSchema.optional(),
    originalLocation: LocationSchema,
    activeLocation: LocationSchema,
    socialLinks: SocialLinksSchema.optional(),
    debutYear: z.number().int().min(1900).max(2100).optional().nullable().transform(val => val ?? undefined),
    inactiveYear: z.number().int().min(1900).max(2100).optional().nullable().transform(val => val ?? undefined),
});

export type ArtistFormData = z.infer<typeof ArtistInputSchema>;