import type { ScreeningLabel } from '../../types';

/**
 * The keys that decide a screening, the same hand as the audit (A accepts, E edits, R rejects): A includes, E marks a
 * doubt, R excludes. They replaced the numbers 1, 2 and 3 on purpose, a point where the app departs from board 164/165
 * (the author's decision, 2026-11-13).
 */
export const KIND_KEYS = { include: 'a', maybe: 'e', exclude: 'r' } as const;

type KeyedKind = keyof typeof KIND_KEYS;

const isKeyedKind = (kind: ScreeningLabel['kind']): kind is KeyedKind => kind in KIND_KEYS;

/**
 * The key of each label shown as an option: the first label of a kind takes its letter; the labels after it (several
 * reasons for exclusion at full text, say) are numbered 1 to 9 among themselves, in the order shown.
 *
 * @example optionKeys(labels) // Map { 10 => 'a', 11 => 'e', 12 => 'r', 13 => '1' } (13 is a second exclusion label)
 */
export function optionKeys(options: ScreeningLabel[]): Map<number, string> {
  const keys = new Map<number, string>();
  const taken = new Set<string>();
  let extra = 0;
  for (const label of options) {
    const letter = isKeyedKind(label.kind) ? KIND_KEYS[label.kind] : undefined;
    if (letter && !taken.has(letter)) {
      taken.add(letter);
      keys.set(label.id, letter);
    } else if (extra < 9) {
      extra += 1;
      keys.set(label.id, String(extra));
    }
  }
  return keys;
}

/**
 * The label a key pressed picks among the options, or undefined.
 *
 * @example labelForKey(options, 'R')?.name // 'Excluído'
 */
export function labelForKey(options: ScreeningLabel[], key: string): ScreeningLabel | undefined {
  const keys = optionKeys(options);
  const wanted = key.toLowerCase();
  return options.find((label) => keys.get(label.id) === wanted);
}
