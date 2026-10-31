import { useState } from 'react';
import type { Article, ScreeningDecision, ScreeningKind, ScreeningLabel, ScreeningStage } from '../../types';
import { KINDS_BY_STAGE } from '../../utils/screeningPresets';
import { decisionAt, guidedPool } from '../../utils/screeningView';
import type { ScreeningState } from './useScreening';

/** One decision made in the guided screening, with what was there before, for "Desfazer" (Z). */
interface GuidedStep {
  articleId: number;
  stage: ScreeningStage;
  previous: ScreeningDecision | null;
}

export type StageTally = Record<ScreeningKind, number>;

export interface GuidedScreening {
  stage: ScreeningStage;
  setStage: (stage: ScreeningStage) => void;
  queue: Article[];
  /** How many articles this stage walks through, decided or not. */
  poolSize: number;
  current: Article | null;
  position: number;
  pending: number;
  finished: boolean;
  options: ScreeningLabel[];
  duplicate: ScreeningLabel | null;
  decisionHere: ScreeningDecision | null;
  tally: StageTally;
  onlyPending: boolean;
  toggleOnlyPending: () => void;
  go: (step: -1 | 1) => void;
  decide: (label: ScreeningLabel, note: string) => Promise<void>;
  undo: () => Promise<void>;
  canUndo: boolean;
  reviewAll: () => void;
}

// Decision buttons of a stage: inclusion, doubt and exclusion labels in order; duplicates have their own link.
const optionsAt = (labels: ScreeningLabel[], stage: ScreeningStage) =>
  KINDS_BY_STAGE[stage].filter((kind) => kind !== 'removed').flatMap((kind) => labels.filter((l) => l.kind === kind));

function tallyAt(pool: Article[], s: ScreeningState, stage: ScreeningStage): StageTally {
  const tally: StageTally = { include: 0, maybe: 0, exclude: 0, removed: 0 };
  for (const article of pool) {
    const kind = s.labels.find((l) => l.id === decisionAt(s.decisions, article.id, stage)?.label_id)?.kind;
    if (kind) tally[kind] += 1;
  }
  return tally;
}

/**
 * State of the guided screening (#49): the stage, the queue of articles, the current one, and deciding, moving and
 * undoing. Deciding moves on to the next article without a decision at this stage.
 *
 * Usage:
 *   const guided = useGuidedScreening(screening);
 *   await guided.decide(label, note);
 */
export function useGuidedScreening(s: ScreeningState): GuidedScreening {
  const [stage, setStageState] = useState<ScreeningStage>('title');
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [steps, setSteps] = useState<GuidedStep[]>([]);

  const pool = guidedPool(s.articles, s.labels, s.decisions, stage);
  const undecided = (a: Article) => decisionAt(s.decisions, a.id, stage) === null;
  const queue = onlyPending ? pool.filter((a) => undecided(a) || a.id === currentId) : pool;
  // Until the person moves, the screening opens on the first article still without a decision at this stage.
  const shownId = currentId ?? queue.find(undecided)?.id ?? null;
  const index = Math.max(
    0,
    queue.findIndex((a) => a.id === shownId),
  );
  const current = queue[index] ?? null;
  const pending = pool.filter(undecided).length;

  const nextUndecidedAfter = (articleId: number) => {
    const from = pool.findIndex((a) => a.id === articleId);
    return pool.find((a, i) => i > from && undecided(a) && a.id !== articleId)?.id ?? articleId;
  };

  const decide = async (label: ScreeningLabel, note: string) => {
    if (!current) return;
    setSteps((prev) => [
      ...prev,
      { articleId: current.id, stage, previous: decisionAt(s.decisions, current.id, stage) },
    ]);
    setCurrentId(nextUndecidedAfter(current.id));
    await s.decide([current.id], label.id, stage, note.trim() || null);
  };

  const undo = async () => {
    const last = steps[steps.length - 1];
    if (!last) return;
    setSteps(steps.slice(0, -1));
    setStageState(last.stage);
    setCurrentId(last.articleId);
    setOnlyPending(false);
    if (last.previous) await s.decide([last.articleId], last.previous.label_id, last.stage, last.previous.note);
    else await s.undecide([last.articleId], last.stage);
  };

  return {
    stage,
    setStage: (next) => {
      setStageState(next);
      setCurrentId(null);
      setReviewing(false);
    },
    queue,
    poolSize: pool.length,
    current,
    position: index,
    pending,
    finished: pending === 0 && !reviewing,
    options: optionsAt(s.labels, stage),
    duplicate: stage === 'title' ? (s.labels.find((l) => l.kind === 'removed') ?? null) : null,
    decisionHere: current ? decisionAt(s.decisions, current.id, stage) : null,
    tally: tallyAt(pool, s, stage),
    onlyPending,
    toggleOnlyPending: () => setOnlyPending(!onlyPending),
    go: (step) => setCurrentId(queue[Math.min(Math.max(index + step, 0), queue.length - 1)]?.id ?? null),
    decide,
    undo,
    canUndo: steps.length > 0,
    reviewAll: () => {
      setReviewing(true);
      setOnlyPending(false);
      setCurrentId(null);
    },
  };
}
