export type DiffKind = 'same' | 'add' | 'del';

export interface DiffPart {
  text: string;
  kind: DiffKind;
}

/** Past this many cells in the table, the middle of the text is shown as replaced as a whole instead of word by word. */
const MAX_TABLE_CELLS = 4_000_000;

// Words and the white space between them are separate pieces, so line breaks and spacing survive the diff.
const tokenize = (text: string): string[] => text.match(/\s+|\S+/g) ?? [];

function merge(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && last.kind === part.kind) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

// The longest common subsequence of two lists of pieces, as a table of lengths read from the end.
function lengthsTable(a: string[], b: string[]): Uint32Array {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  return table;
}

function walkTable(a: string[], b: string[]): DiffPart[] {
  const width = b.length + 1;
  const table = lengthsTable(a, b);
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      parts.push({ text: a[i], kind: 'same' });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      parts.push({ text: a[i++], kind: 'del' });
    } else {
      parts.push({ text: b[j++], kind: 'add' });
    }
  }
  for (; i < a.length; i++) parts.push({ text: a[i], kind: 'del' });
  for (; j < b.length; j++) parts.push({ text: b[j], kind: 'add' });
  return parts;
}

/**
 * What changed between two texts, word by word: pieces in both ("same"), pieces only in `to` ("add", they came in after)
 * and pieces only in `from` ("del", they went out after). Joining the "same" and "del" pieces gives back `from`; the
 * "same" and "add" pieces give back `to`.
 *
 * @example diffWords('a b c', 'a x c') // [{ text: 'a ', same }, { text: 'b', del }, { text: 'x', add }, { text: ' c', same }]
 */
export function diffWords(from: string, to: string): DiffPart[] {
  const a = tokenize(from);
  const b = tokenize(to);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const middleA = a.slice(start, endA);
  const middleB = b.slice(start, endB);
  const tooBig = middleA.length * middleB.length > MAX_TABLE_CELLS;
  const replaced: DiffPart[] = [
    { text: middleA.join(''), kind: 'del' },
    { text: middleB.join(''), kind: 'add' },
  ].filter((part) => part.text) as DiffPart[];
  const middle = tooBig ? replaced : walkTable(middleA, middleB);
  return merge(
    [
      { text: a.slice(0, start).join(''), kind: 'same' },
      ...middle,
      { text: a.slice(endA).join(''), kind: 'same' },
    ].filter((part) => part.text) as DiffPart[],
  );
}

const nonEmptyLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * How many lines each text has that the other does not: `removed` are lines of `from` that are not in `to`, `added`
 * the other way round. A line repeated twice counts twice.
 *
 * @example lineChanges('a\nb', 'a\nc\nd') // { removed: 1, added: 2 }
 */
export function lineChanges(from: string, to: string): { removed: number; added: number } {
  const left = new Map<string, number>();
  for (const line of nonEmptyLines(from)) left.set(line, (left.get(line) ?? 0) + 1);
  let added = 0;
  for (const line of nonEmptyLines(to)) {
    const have = left.get(line) ?? 0;
    if (have > 0) left.set(line, have - 1);
    else added++;
  }
  const removed = [...left.values()].reduce((sum, count) => sum + count, 0);
  return { removed, added };
}

const lines = (count: number) => `${count} ${count === 1 ? 'linha' : 'linhas'}`;

/**
 * The line under a version in the list: what it lacks and what it has less than the current text ("−1 linha, +2
 * linhas"), or that it is the same.
 *
 * @example changeSummary('a\nb', 'a\nc') // '−1 linha, +1 linha'
 */
export function changeSummary(version: string, current: string): string {
  const { removed, added } = lineChanges(version, current);
  const parts = [removed > 0 && `−${lines(removed)}`, added > 0 && `+${lines(added)}`].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'igual à atual';
}
