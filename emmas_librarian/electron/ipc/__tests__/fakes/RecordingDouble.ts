import { vi, type Mock } from 'vitest';

export type RecordingDouble = Record<string, Mock> & { reset(): void };

/**
 * Creates a named test double for wide collaborators (DatabaseAdapter has
 * ~100 methods): any property read returns a stable `vi.fn()` for that name,
 * so tests stub only what a handler touches and assert on what it called.
 *
 * Usage:
 *   const db = createRecordingDouble();
 *   db.getProject.mockReturnValue({ id: 1, name: 'P' });
 *   expect(db.deleteProject).toHaveBeenCalledWith(1);
 */
export function createRecordingDouble(): RecordingDouble {
  const methods = new Map<string, Mock>();
  return new Proxy({} as RecordingDouble, {
    get(_target, property) {
      if (property === 'reset') return () => methods.clear();
      // Not a thenable: `await double` must resolve to the double itself.
      if (typeof property !== 'string' || property === 'then') return undefined;
      if (!methods.has(property)) methods.set(property, vi.fn());
      return methods.get(property);
    },
  });
}
