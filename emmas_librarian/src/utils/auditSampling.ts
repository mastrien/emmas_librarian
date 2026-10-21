import type { InvestigationResult } from '../types';

/** How an audit draws its sample (#48): kept with the investigation, so the same draw can be repeated. */
export interface AuditParams {
  seed: number;
  samplePercent: number;
  minPerQuestion: number;
}

export interface WilsonInterval {
  estimate: number;
  low: number;
  high: number;
}

export interface AuditStats {
  sampled: number;
  marked: number;
  correct: number;
  interval: WilsonInterval | null;
}

// Two-sided 95%.
const Z_95 = 1.959964;

/**
 * A small seeded generator (mulberry32): the same seed always gives the same sequence, so a draw can be repeated
 * from what the audit stored.
 *
 * Usage:
 *   const random = seededRandom(48213); random(); // 0.37...
 */
export function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fresh seed for a new audit.
 *
 * Usage:
 *   saveAudit(id, { seed: newAuditSeed(), samplePercent: 10, minPerQuestion: 2 });
 */
export function newAuditSeed(random: () => number = Math.random): number {
  return Math.floor(random() * 2147483646) + 1;
}

/**
 * How many answers to draw for a question with `available` answers: the requested share, never fewer than the minimum,
 * never more than there are.
 *
 * Usage:
 *   drawSize(40, { samplePercent: 10, minPerQuestion: 2 }); // 4
 */
export function drawSize(available: number, params: Pick<AuditParams, 'samplePercent' | 'minPerQuestion'>): number {
  const requested = Math.round((available * params.samplePercent) / 100);
  return Math.min(available, Math.max(params.minPerQuestion, requested));
}

// Fisher-Yates with the question's own stream, so adding a question does not change the others' draws.
function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const questionSeed = (seed: number, questionIndex: number): number => (Math.imul(seed, 31) + questionIndex) | 0;

/**
 * The audit sample: for each question, a seeded random draw among the answers that came back (errors and skipped
 * answers have nothing to judge). Every question with an answer gets at least one item. Same results and same
 * params always give the same ids.
 *
 * Usage:
 *   const sample = drawStratifiedSample(results, { seed: 48213, samplePercent: 10, minPerQuestion: 2 });
 */
export function drawStratifiedSample(results: InvestigationResult[], params: AuditParams): Set<number> {
  const byQuestion = new Map<string, InvestigationResult[]>();
  for (const result of results) {
    if (result.status !== 'success') continue;
    byQuestion.set(result.question, [...(byQuestion.get(result.question) ?? []), result]);
  }
  const picked = new Set<number>();
  [...byQuestion.keys()].sort().forEach((question, index) => {
    const pool = byQuestion.get(question)!.sort((a, b) => a.id - b.id);
    const size = drawSize(pool.length, { ...params, minPerQuestion: Math.max(1, params.minPerQuestion) });
    shuffled(pool, seededRandom(questionSeed(params.seed, index)))
      .slice(0, size)
      .forEach((result) => picked.add(result.id));
  });
  return picked;
}

/**
 * The Wilson score interval at 95% for `correct` out of `total`, which stays inside 0-1 and is honest with small
 * samples (2 of 2 does not read as a sure 100%). Null when nothing was marked.
 *
 * Usage:
 *   wilsonInterval(2, 2); // { estimate: 1, low: 0.342, high: 1 }
 */
export function wilsonInterval(correct: number, total: number): WilsonInterval | null {
  if (total <= 0) return null;
  const p = correct / total;
  const z2 = Z_95 * Z_95;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const half = (Z_95 * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denominator;
  return { estimate: p, low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

/**
 * Accuracy of a set of sampled answers: accepted counts as correct; edited (the person had to fix it) and rejected
 * count as wrong; pending ones are not marked yet.
 *
 * Usage:
 *   auditStats(sampledResults); // { sampled: 40, marked: 28, correct: 23, interval: {...} }
 */
export function auditStats(sampled: InvestigationResult[]): AuditStats {
  const marked = sampled.filter((r) => r.review_status !== 'pending');
  const correct = marked.filter((r) => r.review_status === 'accepted').length;
  return { sampled: sampled.length, marked: marked.length, correct, interval: wilsonInterval(correct, marked.length) };
}
