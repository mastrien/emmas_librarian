import type { ScreeningDecision, ScreeningKind, ScreeningLabel } from '../types';
import type { ScreeningSuggestion } from '../types/screeningSuggestion';
import { seededRandom } from './auditSampling';

/** How many of how many: a percentage alone hides that it was 2 of 2. */
export interface EvaluationRate {
  hits: number;
  total: number;
}

/** An article the person kept and the engine would have thrown out: the expensive error. */
export interface MissedArticle {
  articleId: number;
  personLabel: string;
  engineLabel: string;
}

export interface CalibrationBand {
  name: string;
  articles: number;
  agreed: number;
}

export interface EngineEvaluation {
  engine: string;
  articles: number;
  /** Of what the person kept (include or maybe), how much the engine would keep too. The main measure. */
  recall: EvaluationRate;
  /** Of what the engine would keep, how much the person kept. */
  precision: EvaluationRate;
  /** The engine marked the same kind the person did: its goal is to get right what the person would mark. */
  agreement: EvaluationRate;
  missed: MissedArticle[];
  calibration: CalibrationBand[];
  meanElapsedMs: number;
  tokensEstimated: number;
}

export interface EvaluationInput {
  decisions: ScreeningDecision[];
  labels: ScreeningLabel[];
  suggestions: ScreeningSuggestion[];
  /** The project's criteria now. Suggestions made with other ones are not comparable and stay out. */
  criteria: string;
}

// "Em dúvida" advances to the full text, so an engine that excludes it loses an article (author's decision, #54).
const keeps = (kind: ScreeningKind): boolean => kind === 'include' || kind === 'maybe';

interface ComparedPair {
  suggestion: ScreeningSuggestion;
  person: ScreeningLabel;
  engine: ScreeningLabel;
}

const BANDS = [
  { name: '80 a 100%', from: 0.8, to: 1.01 },
  { name: '50 a 79%', from: 0.5, to: 0.8 },
  { name: 'Abaixo de 50%', from: 0, to: 0.5 },
];

function calibrationOf(pairs: ComparedPair[]): CalibrationBand[] {
  return BANDS.map(({ name, from, to }) => {
    const inBand = pairs.filter(
      ({ suggestion: { confidence } }) => confidence !== null && confidence >= from && confidence < to,
    );
    const agreed = inBand.filter((pair) => pair.person.kind === pair.engine.kind).length;
    return { name, articles: inBand.length, agreed };
  });
}

function evaluateOne(engine: string, pairs: ComparedPair[]): EngineEvaluation {
  const kept = pairs.filter((pair) => keeps(pair.person.kind));
  const engineKept = pairs.filter((pair) => keeps(pair.engine.kind));
  const lost = kept.filter((pair) => !keeps(pair.engine.kind));
  return {
    engine,
    articles: pairs.length,
    recall: { hits: kept.length - lost.length, total: kept.length },
    precision: { hits: engineKept.filter((pair) => keeps(pair.person.kind)).length, total: engineKept.length },
    agreement: { hits: pairs.filter((pair) => pair.person.kind === pair.engine.kind).length, total: pairs.length },
    missed: lost.map(({ suggestion, person, engine: label }) => ({
      articleId: suggestion.article_id,
      personLabel: person.name,
      engineLabel: label.name,
    })),
    calibration: calibrationOf(pairs),
    meanElapsedMs: pairs.reduce((sum, pair) => sum + pair.suggestion.elapsed_ms, 0) / (pairs.length || 1),
    tokensEstimated: pairs.reduce((sum, pair) => sum + pair.suggestion.tokens_estimated, 0),
  };
}

/**
 * Compares each engine with what the person decided at title and abstract, the stage suggestions read. Duplicates stay
 * out: they leave before screening, and no engine is asked about them.
 *
 * @example evaluateEngines({ decisions, labels, suggestions, criteria })[0].recall // { hits: 37, total: 40 }
 */
export function evaluateEngines({ decisions, labels, suggestions, criteria }: EvaluationInput): EngineEvaluation[] {
  const labelOf = new Map(labels.map((label) => [label.id, label]));
  const personOf = new Map(
    decisions.filter((d) => d.stage === 'title').map((d) => [d.article_id, labelOf.get(d.label_id)]),
  );
  const byEngine = new Map<string, ComparedPair[]>();
  for (const suggestion of suggestions) {
    const person = personOf.get(suggestion.article_id);
    const engine = labelOf.get(suggestion.label_id);
    if (suggestion.criteria !== criteria || !person || !engine || person.kind === 'removed') continue;
    byEngine.set(suggestion.engine, [...(byEngine.get(suggestion.engine) ?? []), { suggestion, person, engine }]);
  }
  return [...byEngine].map(([engine, pairs]) => evaluateOne(engine, pairs));
}

/**
 * A rate as the table shows it, with the counts beside it.
 *
 * @example rateText({ hits: 37, total: 40 }) // '92,5% (37 de 40)'
 */
export function rateText({ hits, total }: EvaluationRate): string {
  if (total === 0) return 'sem dados';
  const percent = ((hits / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${percent}% (${hits} de ${total})`;
}

/**
 * The same articles in the same random order for a project, so a sample of 50 keeps its articles from one run to the
 * next and what was already paid for is not paid again.
 *
 * @example sampleArticles([1, 2, 3, 4], 2, 7) // always the same two
 */
export function sampleArticles(articleIds: number[], size: number, seed: number): number[] {
  const random = seededRandom(seed);
  const ordered = [...articleIds].sort((a, b) => a - b);
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered.slice(0, size);
}
