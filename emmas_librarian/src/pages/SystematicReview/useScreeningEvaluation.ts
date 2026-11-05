import { useEffect, useRef, useState } from 'react';
import { useProjectService } from '../../contexts/ServicesContext';
import type { ScreeningSuggestion } from '../../types';
import { describeError } from '../../utils/describeError';

// A key refused or a provider down would fail the same way for every article: three in a row stop the run.
const FAILURES_TO_STOP = 3;

export interface EvaluationProgress {
  done: number;
  total: number;
}

/**
 * Runs the suggestions an evaluation needs, one article at a time, from the page: what each one answered is saved as it
 * arrives, so stopping or leaving loses nothing, and running again pays only for what is missing.
 *
 * @example const evaluation = useScreeningEvaluation(suggestions.keep); void evaluation.run([1, 2, 3]);
 */
export function useScreeningEvaluation(onSuggestion: (suggestion: ScreeningSuggestion) => void) {
  const service = useProjectService();
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    return () => {
      stopped.current = true;
    };
  }, []);

  const run = async (articleIds: number[]) => {
    stopped.current = false;
    setProblem(null);
    let failuresInARow = 0;
    for (const [i, articleId] of articleIds.entries()) {
      if (stopped.current || failuresInARow === FAILURES_TO_STOP) break;
      setProgress({ done: i, total: articleIds.length });
      try {
        onSuggestion(await service.suggestScreening(articleId));
        failuresInARow = 0;
      } catch (err) {
        failuresInARow += 1;
        setProblem(describeError(err));
      }
    }
    setProgress(null);
  };

  return {
    progress,
    problem,
    run,
    stop: () => {
      stopped.current = true;
    },
  };
}
