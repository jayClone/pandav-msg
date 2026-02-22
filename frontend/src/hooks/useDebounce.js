import { useState, useEffect } from 'react';

/**
 * Debounce hook - delays value update by specified ms
 * Prevents API spam on search inputs
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup on value change
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}