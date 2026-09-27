import { useState, type Dispatch, type SetStateAction } from 'react';

// sessionStorage can throw (blocked storage) or hold a value from an older app version; both fall back.
function readSession<T>(key: string, initial: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}

function writeSession<T>(key: string, value: T): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Losing view state is harmless; the page still works with in-memory state.
  }
}

/**
 * useState that survives the component unmounting for the rest of the app session, e.g. leaving
 * the project page for the PDF reader and coming back. When `key` changes (another project), the
 * value stored under the new key is used.
 *
 * @example const [statusFilter, setStatusFilter] = useSessionState(`project.7.statusFilter`, 'new');
 */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [entry, setEntry] = useState(() => ({ key, value: readSession(key, initial) }));
  const value = entry.key === key ? entry.value : readSession(key, initial);

  const setValue: Dispatch<SetStateAction<T>> = (next) =>
    setEntry((prev) => {
      const current = prev.key === key ? prev.value : readSession(key, initial);
      const resolved = typeof next === 'function' ? (next as (old: T) => T)(current) : next;
      writeSession(key, resolved);
      return { key, value: resolved };
    });

  return [value, setValue];
}
