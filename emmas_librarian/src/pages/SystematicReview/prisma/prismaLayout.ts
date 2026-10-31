import type { PrismaBox, PrismaBoxKey, PrismaFlow, PrismaWarning } from '../../../utils/prismaFlow';

/** A text line of a box; the kind picks its weight and colour. */
export interface BoxLine {
  text: string;
  kind: 'title' | 'line' | 'warn' | 'info';
}

export interface BoxPlace {
  key: PrismaBoxKey;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: BoxLine[];
  /** The whole text, never cut: the name of the box as a button. */
  label: string;
  warned: boolean;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Band {
  label: string;
  y: number;
  h: number;
}

/** Where everything of the diagram goes, in the 800-wide coordinates of its viewBox. */
export interface PrismaLayout {
  width: number;
  height: number;
  boxes: BoxPlace[];
  arrows: Segment[];
  bands: Band[];
}

export const WIDTH = 800;
const BAND_W = 40;
const MAIN = { x: 56, w: 330, chars: 44 };
const SIDE = { x: 466, w: 320, chars: 42 };
const TOP = 16;
const ROW_GAP = 72;
export const LINE_H = 19;
export const PAD = 12;

// The PRISMA 2020 rows: the main flow on the left, where each step sends its exclusions on the right.
const ROWS: [PrismaBoxKey, PrismaBoxKey | null][] = [
  ['identified', 'removed'],
  ['screened', 'excluded'],
  ['sought', 'notRetrieved'],
  ['assessed', 'reasons'],
  ['included', null],
];

const WARNING_LINE: Record<PrismaWarning['kind'], BoxLine> = {
  mismatch: { text: '⚠ não fecha (veja ao lado)', kind: 'warn' },
  partial: { text: '⚠ busca pode ser parcial', kind: 'warn' },
  nodata: { text: 'ⓘ sem dados para conferir', kind: 'info' },
};

/**
 * Cuts a line to the characters that fit the box, with an ellipsis; the full text is in the panel and the table.
 *
 * @example fit('Desenho de estudo não elegível (n = 5)', 20) // 'Desenho de estudo n…'
 */
export function fit(text: string, chars: number): string {
  return text.length <= chars ? text : `${text.slice(0, chars - 1).trimEnd()}…`;
}

/** The lines a box shows: title and number, its lines, one short line per kind of warning. */
export function boxLines(box: PrismaBox, chars: number): BoxLine[] {
  const kinds = [...new Set(box.warnings.map((w) => w.kind))];
  return [
    ...titleLines(box, chars),
    ...box.lines.map((l) => ({ text: withCount(l.label, l.n, chars), kind: 'line' as const })),
    ...kinds.map((k) => WARNING_LINE[k]),
  ];
}

const countOf = (n: number | null) => `(n = ${n ?? 'sem dados'})`;

/**
 * A line with its count, cutting only the label when it is too long: the number is never the part that goes.
 *
 * @example withCount('Desenho de estudo não elegível', 5, 24) // 'Desenho de estu… (n = 5)'
 */
export function withCount(label: string, n: number | null, chars: number): string {
  const count = countOf(n);
  const whole = `${label} ${count}`;
  return whole.length <= chars ? whole : `${fit(label, chars - count.length - 1)} ${count}`;
}

// A title and its number on one line when they fit; otherwise the number gets a line of its own.
function titleLines(box: PrismaBox, chars: number): BoxLine[] {
  const whole = `${box.title} ${countOf(box.n)}`;
  if (whole.length <= chars) return [{ text: whole, kind: 'title' }];
  return [
    { text: fit(box.title, chars), kind: 'title' },
    { text: countOf(box.n), kind: 'title' },
  ];
}

/** The whole text of a box, never cut, for screen readers and the button's name. */
export function boxLabel(box: PrismaBox): string {
  return [`${box.title} ${countOf(box.n)}`, ...box.lines.map((l) => `${l.label} ${countOf(l.n)}`)].join('. ');
}

const heightOf = (lines: BoxLine[]) => PAD * 2 + LINE_H * lines.length;

function placeRow(flow: PrismaFlow, [left, right]: (typeof ROWS)[number], top: number) {
  const leftLines = boxLines(flow[left], MAIN.chars);
  const rightLines = right ? boxLines(flow[right], SIDE.chars) : [];
  const hl = heightOf(leftLines);
  const hr = right ? heightOf(rightLines) : 0;
  const ly = top + Math.max(0, Math.round((hr - hl) / 2));
  const warned = (key: PrismaBoxKey) => flow[key].warnings.some((w) => w.kind !== 'nodata');
  const placed: BoxPlace[] = [
    {
      key: left,
      x: MAIN.x,
      y: ly,
      w: MAIN.w,
      h: hl,
      lines: leftLines,
      label: boxLabel(flow[left]),
      warned: warned(left),
    },
  ];
  if (right) {
    const ry = ly + Math.round(hl / 2 - hr / 2);
    placed.push({
      key: right,
      x: SIDE.x,
      y: ry,
      w: SIDE.w,
      h: hr,
      lines: rightLines,
      label: boxLabel(flow[right]),
      warned: warned(right),
    });
  }
  const bottom = Math.max(...placed.map((p) => p.y + p.h));
  return { placed, bottom };
}

function arrowsOf(boxes: BoxPlace[]): Segment[] {
  const left = boxes.filter((b) => b.x === MAIN.x);
  const down = left.slice(1).map((b, i) => {
    const above = left[i];
    const x = above.x + above.w / 2;
    return { x1: x, y1: above.y + above.h, x2: x, y2: b.y - 1 };
  });
  const across = boxes
    .filter((b) => b.x === SIDE.x)
    .map((b) => {
      const from = left.find((l) => Math.abs(l.y + l.h / 2 - (b.y + b.h / 2)) <= 1)!;
      const y = from.y + from.h / 2;
      return { x1: from.x + from.w, y1: y, x2: b.x - 1, y2: y };
    });
  return [...down, ...across];
}

function bandsOf(rowTops: number[], rowBottoms: number[]): Band[] {
  const span = (label: string, from: number, to: number) => ({
    label,
    y: rowTops[from],
    h: rowBottoms[to] - rowTops[from],
  });
  return [span('Identificação', 0, 0), span('Triagem', 1, 3), span('Incluídos', 4, 4)];
}

/**
 * Places the boxes, arrows and phase bands of the PRISMA 2020 diagram. Boxes grow with their lines, the box a
 * step sends exclusions to is centred on it, so every arrow is straight.
 *
 * @example prismaLayout(flow).boxes.find((b) => b.key === 'included')!.y
 */
export function prismaLayout(flow: PrismaFlow): PrismaLayout {
  const boxes: BoxPlace[] = [];
  const tops: number[] = [];
  const bottoms: number[] = [];
  let top = TOP;
  for (const row of ROWS) {
    const { placed, bottom } = placeRow(flow, row, top);
    boxes.push(...placed);
    tops.push(Math.min(...placed.map((p) => p.y)));
    bottoms.push(bottom);
    top = bottom + ROW_GAP;
  }
  return {
    width: WIDTH,
    height: bottoms[bottoms.length - 1] + TOP,
    boxes,
    arrows: arrowsOf(boxes),
    bands: bandsOf(tops, bottoms),
  };
}

export { BAND_W };
