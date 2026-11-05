import { useCallback, useEffect, useState } from 'react';
import { useProjectService } from '../../contexts/ServicesContext';
import type { ScreeningCriteria, ScreeningEngineInfo, ScreeningSuggestion } from '../../types';
import { describeError } from '../../utils/describeError';
import { criteriaSnapshot } from '../../utils/screeningCriteria';

const NO_CRITERIA: ScreeningCriteria = { inclusion: '', exclusion: '' };

/** A failed attempt, kept with its article so moving on starts clean. */
interface SuggestionFailure {
  articleId: number;
  message: string;
}

/**
 * The criteria, the engine and the suggestions of a project (#54). Nothing here asks a model by itself: only `suggest`
 * does, when the person asks.
 *
 * @example const suggestions = useScreeningSuggestions(projectId); void suggestions.suggest(article.id);
 */
export function useScreeningSuggestions(projectId: number) {
  const service = useProjectService();
  const [criteria, setCriteria] = useState<ScreeningCriteria>(NO_CRITERIA);
  const [engine, setEngine] = useState<ScreeningEngineInfo | null>(null);
  const [suggestions, setSuggestions] = useState<ScreeningSuggestion[]>([]);
  const [running, setRunning] = useState<number | null>(null);
  const [failure, setFailure] = useState<SuggestionFailure | null>(null);

  const keep = useCallback((saved: ScreeningSuggestion) => {
    setSuggestions((now) => [...now.filter((s) => s.id !== saved.id), saved]);
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      service.getScreeningCriteria(projectId),
      service.getScreeningEngine(),
      service.getScreeningSuggestions(projectId),
    ]).then(([foundCriteria, foundEngine, found]) => {
      if (!alive) return;
      setCriteria(foundCriteria);
      setEngine(foundEngine);
      setSuggestions(found);
    });
    return () => {
      alive = false;
    };
  }, [service, projectId]);

  const suggest = async (articleId: number) => {
    setRunning(articleId);
    setFailure(null);
    try {
      keep(await service.suggestScreening(articleId));
    } catch (err) {
      setFailure({ articleId, message: describeError(err) });
    } finally {
      setRunning(null);
    }
  };

  const forArticle = (articleId: number) =>
    suggestions.find((s) => s.article_id === articleId && s.engine === engine?.id) ?? null;

  return {
    criteria,
    setCriteria,
    engine,
    suggestions,
    keep,
    suggest,
    running,
    forArticle,
    failureOf: (articleId: number) => (failure?.articleId === articleId ? failure.message : null),
    isStale: (suggestion: ScreeningSuggestion) => suggestion.criteria !== criteriaSnapshot(criteria),
  };
}
