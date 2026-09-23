import { useEffect, useState } from 'react';

/**
 * `value`, updated only after it has stopped changing for `delay` ms.
 *
 * Usage:
 *   const debouncedAst = useDebounce(ast, 600);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeoutId);
  }, [value, delay]);
  return debouncedValue;
}
