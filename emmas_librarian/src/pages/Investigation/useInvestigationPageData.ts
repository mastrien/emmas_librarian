import { useEffect, useState } from 'react';
import { useProjectService } from '../../contexts/ServicesContext';
import { useGlobalError } from '../../contexts/GlobalErrorContext';
import type { Article, InvestigationHistoryRecord, Project, SearchHistoryItem } from '../../types';
import { describeExtractionModel } from './useInvestigationRun';
import { isPendingReview } from './investigationView';

/**
 * What the investigation page shows: the project, its articles and investigations, the model the next run will
 * use and how many answers of each investigation wait for review. `savedId` reloads the list when a run was saved.
 *
 * @example const data = useInvestigationPageData(3, run?.savedId ?? null);
 */
export function useInvestigationPageData(projectId: number, savedId: number | null) {
  const service = useProjectService();
  const { showError } = useGlobalError();
  const [project, setProject] = useState<Project | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [history, setHistory] = useState<InvestigationHistoryRecord[]>([]);
  const [pendingById, setPendingById] = useState<Record<number, number>>({});
  const [auditedIds, setAuditedIds] = useState<number[]>([]);
  const [modelLabel, setModelLabel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [p, a, s, m] = await Promise.all([
          service.getProject(projectId),
          service.getArticles(projectId),
          service.getSearchHistory(projectId),
          describeExtractionModel(service),
        ]);
        if (!alive) return;
        setProject(p ?? null);
        setArticles(a);
        setSearchHistory(s);
        setModelLabel(m);
      } catch (err) {
        showError(err);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads once per project
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const records = (await service.getMassiveInvestigations(projectId)) as InvestigationHistoryRecord[];
        const [audits, rows] = await Promise.all([
          service.getInvestigationAuditsByProject(projectId),
          Promise.all(records.map((r) => service.getInvestigationResults(r.id))),
        ]);
        if (!alive) return;
        setHistory(records);
        setAuditedIds(audits.map((a) => a.investigation_id));
        setPendingById(Object.fromEntries(records.map((r, i) => [r.id, rows[i].filter(isPendingReview).length])));
      } catch (err) {
        showError(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloads when a run was saved
  }, [projectId, savedId]);

  const setPending = (investigationId: number, pending: number) =>
    setPendingById((now) => (now[investigationId] === pending ? now : { ...now, [investigationId]: pending }));

  return { project, articles, searchHistory, history, pendingById, auditedIds, modelLabel, loading, setPending };
}
