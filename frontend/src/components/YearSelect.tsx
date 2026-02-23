import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from './Icons/FormIcons';

interface YearSelectProps {
    value?: number;
    onChange: (year: number | undefined) => void;
    placeholder?: string;
    label?: string;
    minYear?: number;
    maxYear?: number;
}

const YearSelect = ({
    value,
    onChange,
    placeholder = 'Select year',
    label,
    minYear = 1900,
    maxYear = new Date().getFullYear()
}: YearSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Generate year options (newest first)
    const years = Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => maxYear - i
    );

    // Update dropdown position
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                !buttonRef.current?.contains(target) &&
                !dropdownRef.current?.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (year: number) => {
        onChange(year);
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange(undefined);
        setIsOpen(false);
    };

    return (
        <div>
            {label && (
                <label className="block text-sm font-bold text-gray-700 mb-1">
                    {label}
                </label>
            )}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md text-left flex items-center justify-between focus:outline-none focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
            >
                <span className={value ? 'text-gray-900' : 'text-gray-400'}>
                    {value || placeholder}
                </span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
                    style={{
                        top: `${dropdownPosition.top + 4}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`
                    }}
                >
                    {value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                        >
                            Clear
                        </button>
                    )}
                    {years.map((year) => (
                        <button
                            key={year}
                            type="button"
                            onClick={() => handleSelect(year)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                year === value ? 'bg-primary/5 text-primary font-medium' : 'text-gray-900'
                            }`}
                        >
                            {year}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default YearSelect;
