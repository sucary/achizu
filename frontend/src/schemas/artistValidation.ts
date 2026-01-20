import { z } from 'zod';

export const CoordinatesSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});

export const LocationSchema = z.object({
    city: z.string().min(1, "City is required"),
    province: z.string().min(1, "Province is required"),
    coordinates: CoordinatesSchema,
});

export const SocialLinksSchema = z.object({
    instagram: z.string().url("Invalid Instagram URL").optional().or(z.literal('')),
    twitter: z.string().url("Invalid Twitter URL").optional().or(z.literal('')),
    spotify: z.string().url("Invalid Spotify URL").optional().or(z.literal('')),
    website: z.string().url("Invalid Website URL").optional().or(z.literal('')),
    youtube: z.string().url("Invalid YouTube URL").optional().or(z.literal('')),
});

export const ArtistSchema = z.object({
    name: z.string().min(1, "Name is required"),
    profilePicture: z.string().optional(),
    originalLocation: LocationSchema,
    activeLocation: LocationSchema,
    socialLinks: SocialLinksSchema.optional(),
});

export type ArtistFormData = z.infer<typeof ArtistSchema>;