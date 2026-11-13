import { describe, it, expect } from 'vitest';
import type { ScreeningKind, ScreeningLabel } from '../../../types';
import { KIND_KEYS, labelForKey, optionKeys } from '../decisionKeys';

const label = (id: number, kind: ScreeningKind): ScreeningLabel => ({
  id,
  project_id: 1,
  name: `L${id}`,
  kind,
  position: id,
  preset_key: null,
  created_at: '',
});

describe('KIND_KEYS', () => {
  it('uses the keys of the audit: A includes, E marks a doubt, R excludes', () => {
    expect(KIND_KEYS).toEqual({ include: 'a', maybe: 'e', exclude: 'r' });
  });
});

describe('optionKeys', () => {
  it('gives the first label of each kind its letter', () => {
    const keys = optionKeys([label(1, 'include'), label(2, 'maybe'), label(3, 'exclude')]);

    expect([...keys.values()]).toEqual(['a', 'e', 'r']);
  });

  it('numbers the labels that come after the first of their kind, among themselves', () => {
    const keys = optionKeys([label(1, 'include'), label(2, 'exclude'), label(3, 'exclude'), label(4, 'exclude')]);

    expect(keys.get(2)).toBe('r');
    expect(keys.get(3)).toBe('1');
    expect(keys.get(4)).toBe('2');
  });

  it('never uses 1, 2 or 3 for the first include, doubt and exclusion', () => {
    const keys = optionKeys([label(1, 'include'), label(2, 'maybe'), label(3, 'exclude')]);

    expect(['1', '2', '3'].some((n) => [...keys.values()].includes(n))).toBe(false);
  });

  it('numbers up to nine extras and leaves the rest without a key', () => {
    const many = [label(1, 'exclude'), ...Array.from({ length: 11 }, (_, i) => label(i + 2, 'exclude'))];

    const keys = optionKeys(many);

    expect(keys.get(10)).toBe('9');
    expect(keys.has(11)).toBe(false);
  });
});

describe('labelForKey', () => {
  const options = [label(1, 'include'), label(2, 'maybe'), label(3, 'exclude'), label(4, 'exclude')];

  it('finds the label of a key, in either case', () => {
    expect(labelForKey(options, 'A')?.id).toBe(1);
    expect(labelForKey(options, 'e')?.id).toBe(2);
    expect(labelForKey(options, 'R')?.id).toBe(3);
    expect(labelForKey(options, '1')?.id).toBe(4);
  });

  it('is undefined for a key that picks nothing, such as the old 2 and 3', () => {
    expect(labelForKey(options, '2')).toBeUndefined();
    expect(labelForKey(options, '3')).toBeUndefined();
    expect(labelForKey(options, 'x')).toBeUndefined();
  });
});
