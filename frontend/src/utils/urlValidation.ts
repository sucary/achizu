import type { SocialLinkKey } from '../constants/artist';

const PLATFORM_PATTERNS: Record<SocialLinkKey, RegExp> = {
    website: /^https?:\/\/.+\..+/i,
    instagram: /^https?:\/\/(www\.)?instagram\.com\/.+/i,
    twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+/i,
    appleMusic: /^https?:\/\/.+\..+/i,
    youtube: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i,
};

const PLATFORM_NAMES: Record<SocialLinkKey, string> = {
    website: 'website',
    instagram: 'Instagram',
    twitter: 'Twitter/X',
    appleMusic: 'music',
    youtube: 'YouTube',
};

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export const validateSocialUrl = (key: SocialLinkKey, value: string): ValidationResult => {
    // Empty is valid (optional field)
    if (!value || value.trim() === '') {
        return { isValid: true };
    }

    const trimmed = value.trim();
    const pattern = PLATFORM_PATTERNS[key];

    if (!pattern.test(trimmed)) {
        if (key === 'website') {
            return { isValid: false, error: 'Enter a valid URL (https://...)' };
        }
        return { isValid: false, error: `Enter a valid ${PLATFORM_NAMES[key]} profile URL` };
    }

    return { isValid: true };
};

export const validateAllSocialLinks = (
    socialLinks: Partial<Record<SocialLinkKey, string>> | undefined
): { isValid: boolean; errors: Partial<Record<SocialLinkKey, string>> } => {
    const errors: Partial<Record<SocialLinkKey, string>> = {};

    if (!socialLinks) {
        return { isValid: true, errors };
    }

    for (const [key, value] of Object.entries(socialLinks)) {
        const result = validateSocialUrl(key as SocialLinkKey, value || '');
        if (!result.isValid && result.error) {
            errors[key as SocialLinkKey] = result.error;
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};
