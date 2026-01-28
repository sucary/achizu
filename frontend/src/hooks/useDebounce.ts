import { useState, useEffect } from 'react';

/**
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 1000ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 1000): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}
