import { describe, expect, it } from 'vitest';
import { PendingSearchStore } from '../PendingSearchStore';

function sequentialIds(): () => string {
  let next = 0;
  return () => `search-${++next}`;
}

describe('PendingSearchStore', () => {
  it('hands back the entry stored under an id', () => {
    const store = new PendingSearchStore<string>(sequentialIds());
    const id = store.put('resultados');

    expect(store.get(id)).toBe('resultados');
  });

  it('forgets a discarded entry', () => {
    const store = new PendingSearchStore<string>(sequentialIds());
    const id = store.put('resultados');

    store.discard(id);

    expect(store.get(id)).toBeUndefined();
  });

  it('keeps only the five most recent entries', () => {
    const store = new PendingSearchStore<number>(sequentialIds());
    const ids = [1, 2, 3, 4, 5, 6].map((n) => store.put(n));

    expect(store.get(ids[0])).toBeUndefined();
    expect(store.get(ids[1])).toBe(2);
    expect(store.get(ids[5])).toBe(6);
  });
});
