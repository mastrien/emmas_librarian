import type { PrismaBox, PrismaBoxKey, PrismaFlow, PrismaWarning } from '../../../utils/prismaFlow';
import { referenceTokens, wrapTokens, type FooterLine } from './prismaReference';

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

/** A straight line; `head` puts an arrowhead at its end (the first leg of an elbow has none). */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  head: boolean;
}

export interface Band {
  label: string;
  y: number;
  h: number;
}

/** A column heading of PRISMA 2020, drawn over the boxes of its column. */
export interface ColumnHead {
  label: string;
  x: number;
  w: number;
}

/** Where everything of the diagram goes, in the coordinates of its viewBox. */
export interface PrismaLayout {
  width: number;
  height: number;
  boxes: BoxPlace[];
  arrows: Segment[];
  bands: Band[];
  heads: ColumnHead[];
  footer: { y: number; lines: FooterLine[] };
}

interface Slot {
  x: number;
  w: number;
  chars: number;
}

// One column keeps the roomy boxes of a databases-only review; two columns share a wider figure.
const ONE = { width: 800, main: { x: 56, w: 330, chars: 44 }, side: { x: 466, w: 320, chars: 42 } };
const TWO = {
  width: 1000,
  main: { x: 52, w: 250, chars: 33 },
  side: { x: 338, w: 200, chars: 26 },
  omMain: { x: 578, w: 220, chars: 29 },
  omSide: { x: 834, w: 166, chars: 21 },
};
export const BAND_W = 36;
export const HEAD_H = 40;
export const LINE_H = 19;
export const PAD = 12;
export const FOOTER_LINE_H = 16;
const TOP = HEAD_H + 16;
const ROW_GAP = 64;
const FOOTER_GAP = 28;

// The PRISMA 2020 rows: per column, the step and the box it sends exclusions to.
type Pair = [PrismaBoxKey, PrismaBoxKey | null] | null;
const ROWS: { databases: Pair; other: Pair }[] = [
  { databases: ['identified', 'removed'], other: ['omIdentified', null] },
  { databases: ['screened', 'excluded'], other: null },
  { databases: ['sought', 'notRetrieved'], other: ['omSought', 'omNotRetrieved'] },
  { databases: ['assessed', 'reasons'], other: ['omAssessed', 'omReasons'] },
  { databases: ['included', null], other: null },
];

const WARNING_LINE: Record<PrismaWarning['kind'], BoxLine> = {
  mismatch: { text: '⚠ números não batem (veja ao lado)', kind: 'warn' },
  pending: { text: '⚠ aguardando decisões (veja ao lado)', kind: 'warn' },
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

/**
 * A warning wrapped at word breaks to the box's width. Uncut, it ran past the narrow boxes of the two-column
 * diagram (validation of epic #44); cutting it would drop the "(veja ao lado)" pointer.
 *
 * @example warningLines('mismatch', 21) // ['⚠ números não batem', '(veja ao lado)'], as BoxLines
 */
export function warningLines(kind: PrismaWarning['kind'], chars: number): BoxLine[] {
  const { text, kind: lineKind } = WARNING_LINE[kind];
  const words = text.split(' ').map((word) => ({ text: word }));
  return wrapTokens(words, chars).map((line) => ({
    text: line.segments.map((s) => s.text).join(' '),
    kind: lineKind,
  }));
}

/** The lines a box shows: title and number, its lines, each kind of warning wrapped to fit. */
export function boxLines(box: PrismaBox, chars: number): BoxLine[] {
  const kinds = [...new Set(box.warnings.map((w) => w.kind))];
  return [
    ...titleLines(box, chars),
    ...box.lines.map((l) => ({ text: withCount(l.label, l.n, chars), kind: 'line' as const })),
    // Two characters short: the ⚠ and the medium weight run wider than a regular line (measured in Chrome).
    ...kinds.flatMap((k) => warningLines(k, chars - 2)),
  ];
}

/** The whole text of a box, never cut, for screen readers and the button's name. */
export function boxLabel(box: PrismaBox): string {
  return [`${box.title} ${countOf(box.n)}`, ...box.lines.map((l) => `${l.label} ${countOf(l.n)}`)].join('. ');
}

const heightOf = (lines: BoxLine[]) => PAD * 2 + LINE_H * lines.length;

function place(flow: PrismaFlow, key: PrismaBoxKey, slot: Slot): BoxPlace {
  const lines = boxLines(flow[key], slot.chars);
  const warned = flow[key].warnings.some((w) => w.kind !== 'nodata');
  return { key, x: slot.x, y: 0, w: slot.w, h: heightOf(lines), lines, label: boxLabel(flow[key]), warned };
}

function slotsOf(flow: PrismaFlow): Record<'main' | 'side' | 'omMain' | 'omSide', Slot> {
  return flow.otherMethods ? TWO : { ...ONE, omMain: ONE.main, omSide: ONE.side };
}

// Every box of a row is centred on the row, so the arrow from a step to its exclusions is straight.
function placeRow(flow: PrismaFlow, row: (typeof ROWS)[number], top: number) {
  const s = slotsOf(flow);
  const pairs: [Pair, Slot, Slot][] = [[row.databases, s.main, s.side]];
  if (flow.otherMethods) pairs.push([row.other, s.omMain, s.omSide]);
  const placed = pairs.flatMap(([pair, main, side]) =>
    pair ? [place(flow, pair[0], main), ...(pair[1] ? [place(flow, pair[1], side)] : [])] : [],
  );
  const height = Math.max(...placed.map((p) => p.h));
  placed.forEach((p) => (p.y = top + Math.round((height - p.h) / 2)));
  return { placed, bottom: top + height };
}

const at = (boxes: BoxPlace[], key: PrismaBoxKey) => boxes.find((b) => b.key === key);
const midX = (b: BoxPlace) => b.x + b.w / 2;
const midY = (b: BoxPlace) => b.y + b.h / 2;
const down = (from: BoxPlace, to: BoxPlace): Segment => ({
  x1: midX(from),
  y1: from.y + from.h,
  x2: midX(from),
  y2: to.y - 1,
  head: true,
});
const across = (from: BoxPlace, to: BoxPlace): Segment => ({
  x1: from.x + from.w,
  y1: midY(from),
  x2: to.x - 1,
  y2: midY(from),
  head: true,
});

function chain(boxes: BoxPlace[], keys: PrismaBoxKey[]): Segment[] {
  const found = keys.map((k) => at(boxes, k)).filter((b): b is BoxPlace => b !== undefined);
  return found.slice(1).map((b, i) => down(found[i], b));
}

function sideArrows(boxes: BoxPlace[]): Segment[] {
  const pairs = ROWS.flatMap((r) => [r.databases, r.other]).filter((p): p is [PrismaBoxKey, PrismaBoxKey] => !!p?.[1]);
  return pairs.flatMap(([main, side]) => {
    const from = at(boxes, main);
    const to = at(boxes, side);
    return from && to ? [across(from, to)] : [];
  });
}

// The other column meets the included box from the side: down from its last step, then left with the head.
function elbow(boxes: BoxPlace[]): Segment[] {
  const from = at(boxes, 'omAssessed');
  const to = at(boxes, 'included');
  if (!from || !to) return [];
  const y = midY(to);
  return [
    { x1: midX(from), y1: from.y + from.h, x2: midX(from), y2: y, head: false },
    { x1: midX(from), y1: y, x2: to.x + to.w + 1, y2: y, head: true },
  ];
}

function arrowsOf(boxes: BoxPlace[]): Segment[] {
  return [
    ...chain(boxes, ['identified', 'screened', 'sought', 'assessed', 'included']),
    ...chain(boxes, ['omIdentified', 'omSought', 'omAssessed']),
    ...sideArrows(boxes),
    ...elbow(boxes),
  ];
}

function bandsOf(rowTops: number[], rowBottoms: number[]): Band[] {
  const span = (label: string, from: number, to: number) => ({
    label,
    y: rowTops[from],
    h: rowBottoms[to] - rowTops[from],
  });
  return [span('Identificação', 0, 0), span('Triagem', 1, 3), span('Incluído', 4, 4)];
}

function headsOf(flow: PrismaFlow): ColumnHead[] {
  const s = slotsOf(flow);
  const databases = { label: 'Identificação de estudos via bases de dados e repositórios', x: s.main.x };
  if (!flow.otherMethods) return [{ ...databases, w: s.side.x + s.side.w - s.main.x }];
  return [
    { ...databases, w: s.side.x + s.side.w - s.main.x },
    { label: 'Identificação de estudos por outros métodos', x: s.omMain.x, w: s.omSide.x + s.omSide.w - s.omMain.x },
  ];
}

/**
 * Places the boxes, arrows, column heads, phase bands and the reference footer of the PRISMA 2020 diagram. The
 * "other methods" column appears only when articles came from outside the searches, as the template asks.
 * `today` is the access date the reference gives for the template.
 *
 * @example prismaLayout(flow, new Date()).boxes.find((b) => b.key === 'included')!.y
 */
export function prismaLayout(flow: PrismaFlow, today: Date): PrismaLayout {
  const width = flow.otherMethods ? TWO.width : ONE.width;
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
  const lines = wrapTokens(referenceTokens(today), Math.floor(width / 6.2));
  const footerY = bottoms[bottoms.length - 1] + FOOTER_GAP;
  return {
    width,
    height: footerY + lines.length * FOOTER_LINE_H + 8,
    boxes,
    arrows: arrowsOf(boxes),
    bands: bandsOf(tops, bottoms),
    heads: headsOf(flow),
    footer: { y: footerY, lines },
  };
}
