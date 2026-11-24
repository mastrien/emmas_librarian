import { randomUUID } from 'crypto';

// Results the user has not saved yet stay in memory only; a few are enough (one per open search page).
const MAX_PENDING = 5;

/**
 * Holds search results between "Fazer Busca" and the user's choice to save or discard them.
 *
 * @example const id = store.put(pending); store.get(id); store.discard(id);
 */
export class PendingSearchStore<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly newId: () => string = randomUUID) {}

  put(entry: T): string {
    const id = this.newId();
    this.entries.set(id, entry);
    this.dropOldest();
    return id;
  }

  /** The entry, or undefined when it was discarded, saved already or evicted. */
  get(id: string): T | undefined {
    return this.entries.get(id);
  }

  discard(id: string): void {
    this.entries.delete(id);
  }

  private dropOldest(): void {
    // Map keeps insertion order, so the first key is the oldest pending search.
    while (this.entries.size > MAX_PENDING) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }
}
