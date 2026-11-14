import { describe, it, expect } from 'vitest';
import { CITATION_CHOICES, readRememberedChoice, rememberChoice, renderingOf } from '../citationChoice';

/** A storage held in memory, so the test does not depend on the browser's. */
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class BlockedStorage {
  getItem(): string | null {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('blocked');
  }
}

describe('citation choices', () => {
  it('lists the styles first and BibTeX last', () => {
    expect(CITATION_CHOICES.map((c) => c.label)).toEqual(['ABNT', 'APA', 'Vancouver', 'Harvard', 'IEEE', 'BibTeX']);
  });

  it('renders a style as rich text and BibTeX as its own format', () => {
    expect(renderingOf('apa')).toEqual({ style: 'apa', format: 'html' });
    expect(renderingOf('bibtex')).toEqual({ style: 'abnt', format: 'bibtex' });
  });

  it('gives back what was remembered', () => {
    const storage = new MemoryStorage();
    rememberChoice('vancouver', storage);

    expect(readRememberedChoice(storage)).toBe('vancouver');
  });

  it('falls back to ABNT when nothing, or something unknown, was remembered', () => {
    const storage = new MemoryStorage();
    expect(readRememberedChoice(storage)).toBe('abnt');

    storage.setItem('emma_citation_choice', 'chicago');
    expect(readRememberedChoice(storage)).toBe('abnt');
  });

  it('survives a storage that refuses to read or write', () => {
    expect(readRememberedChoice(new BlockedStorage())).toBe('abnt');
    expect(() => rememberChoice('apa', new BlockedStorage())).not.toThrow();
  });
});
