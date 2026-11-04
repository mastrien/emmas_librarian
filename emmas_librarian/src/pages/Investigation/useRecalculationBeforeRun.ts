import { useState } from 'react';
import { useProjectService } from '../../contexts/ServicesContext';
import type { AskIndexPlan } from '../../types';

interface PendingRun {
  plan: AskIndexPlan;
  articleIds: number[];
  run: () => void;
}

/**
 * Stops an investigation from starting over PDFs indexed by another embedding model, or from taking the library's
 * vectors out with a model of another size, before the person says so. PDFs simply never indexed need no question:
 * the investigation indexes them as it goes, as it always did.
 *
 * @example const recalculation = useRecalculationBeforeRun(); void recalculation.check([1, 2], start);
 */
export function useRecalculationBeforeRun() {
  const service = useProjectService();
  const [pending, setPending] = useState<PendingRun | null>(null);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);

  const check = async (articleIds: number[], run: () => void) => {
    setChecking(true);
    // Without a plan (no key, provider down) the run still starts, and says why at each article.
    const plan = await service.getAskIndexPlan({ articleIds }).catch(() => null);
    setChecking(false);
    if (plan && (plan.sizeChanged || plan.outdated > 0)) setPending({ plan, articleIds, run });
    else run();
  };

  // A PDF that could not be recalculated is refused by the run, which shows why next to it.
  const confirm = async () => {
    if (!pending) return;
    setRunning(true);
    await service.indexAskMissing({ articleIds: pending.articleIds }, pending.plan.sizeChanged).catch((err) => {
      console.error(JSON.stringify({ event: 'index_recalculation_failed', error: String(err) }));
    });
    setRunning(false);
    setPending(null);
    pending.run();
  };

  return { plan: pending?.plan ?? null, checking, running, check, confirm, dismiss: () => setPending(null) };
}
