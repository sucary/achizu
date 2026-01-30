import type { ComponentType, SVGProps } from 'react';

export interface SocialLinkField {
    key: string;
    icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
    placeholder: string;
}

interface SocialLinkInputProps {
    field: SocialLinkField;
    value: string;
    onChange: (key: string, value: string) => void;
}

const SocialLinkInput = ({ field, value, onChange }: SocialLinkInputProps) => {
    const { key, icon: Icon, placeholder } = field;
    const iconColor = value ? 'text-[#FA2D48]' : 'text-gray-400';

    return (
        <div className="relative">
            <input
                type="text"
                placeholder={placeholder}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#FA2D48] focus:ring-1 focus:ring-inset focus:ring-[#FA2D48]"
                value={value}
                onChange={(e) => onChange(key, e.target.value)}
            />
            <Icon className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${iconColor}`} />
        </div>
    );
};

export default SocialLinkInput;
