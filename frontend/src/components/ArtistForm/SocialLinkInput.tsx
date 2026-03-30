import { useState, useMemo } from 'react';
import type { ComponentType, SVGProps } from 'react';
import type { SocialLinkKey } from '../../constants/artist';
import { validateSocialUrl } from '../../utils/urlValidation';

export interface SocialLinkField {
    key: SocialLinkKey;
    icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
    placeholder: string;
}

interface SocialLinkInputProps {
    field: SocialLinkField;
    value: string;
    onChange: (key: SocialLinkKey, value: string) => void;
}

const SocialLinkInput = ({ field, value, onChange }: SocialLinkInputProps) => {
    const { key, icon: Icon, placeholder } = field;
    const [error, setError] = useState<string | null>(null);
    const [touched, setTouched] = useState(false);

    const isValid = useMemo(() => {
        if (!value) return false;
        return validateSocialUrl(key, value).isValid;
    }, [key, value]);

    const handleBlur = () => {
        setTouched(true);
        const result = validateSocialUrl(key, value);
        setError(result.error || null);
    };

    const handleChange = (newValue: string) => {
        onChange(key, newValue);
        if (error) setError(null);
    };

    return (
        <div className="relative">
            <input
                aria-label={placeholder}
                type="text"
                placeholder={placeholder}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
            />
            <Icon aria-hidden="true" className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${isValid ? 'text-primary' : 'text-text-muted'}`} />
            {touched && error && (
                <p role="alert" className="text-xs text-error mt-1">{error}</p>
            )}
        </div>
    );
};

export default SocialLinkInput;
