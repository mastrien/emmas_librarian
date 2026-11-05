import { useCallback, useEffect, useState } from 'react';
import { useProjectService } from '../../contexts/ServicesContext';
import type { ArticleVectorPlan } from '../../types';
import { describeError } from '../../utils/describeError';

export interface VectorProgress {
  done: number;
  total: number;
}

/**
 * The vectors of title and abstract of a project (#55): how many are missing and generating them, a batch at a time.
 * `active` keeps it quiet until the person turned something on that needs them.
 *
 * @example const vectors = useArticleVectors(projectId, enabled); void vectors.generate();
 */
export function useArticleVectors(projectId: number, active: boolean, onGenerated?: () => void) {
  const service = useProjectService();
  const [plan, setPlan] = useState<ArticleVectorPlan | null>(null);
  const [progress, setProgress] = useState<VectorProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setPlan(await service.getArticleVectorPlan(projectId));
    } catch (err) {
      setError(describeError(err));
    }
  }, [service, projectId]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    service
      .getArticleVectorPlan(projectId)
      .then((found) => {
        if (alive) setPlan(found);
      })
      .catch((err) => {
        if (alive) setError(describeError(err));
      });
    return () => {
      alive = false;
    };
  }, [active, service, projectId]);

  const generate = async () => {
    const total = plan?.pending ?? 0;
    setError(null);
    setProgress({ done: 0, total });
    try {
      let pending = total;
      while (pending > 0) {
        ({ pending } = await service.generateArticleVectors(projectId));
        setProgress({ done: total - pending, total });
      }
    } catch (err) {
      setError(describeError(err));
    }
    setProgress(null);
    await reload();
    onGenerated?.();
  };

  return { plan, progress, error, generate };
}
