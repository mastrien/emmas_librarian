import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Article, Project, ScreeningDecision, ScreeningLabel, ScreeningStage } from '../../types';
import { useProjectService } from '../../contexts/ServicesContext';
import type { IProjectService } from '../../services/ProjectServiceInterface';
import { buildReview, decisionAt, type ReviewView } from '../../utils/screeningView';

interface ScreeningData {
  project: Project | null;
  articles: Article[];
  labels: ScreeningLabel[];
  decisions: ScreeningDecision[];
}

/** The last change made on the page, with what takes it back (the toast's "Desfazer"). */
export interface ScreeningChange {
  text: string;
  undo: () => Promise<void>;
}

export interface ScreeningState extends ScreeningData {
  loading: boolean;
  view: ReviewView;
  lastChange: ScreeningChange | null;
  reload: () => Promise<void>;
  decide: (articleIds: number[], labelId: number, stage: ScreeningStage, note?: string | null) => Promise<void>;
  undecide: (articleIds: number[], stage: ScreeningStage) => Promise<void>;
  dismissChange: () => void;
}

const EMPTY: ScreeningData = { project: null, articles: [], labels: [], decisions: [] };

async function loadScreening(service: IProjectService, projectId: number): Promise<ScreeningData> {
  const [project, articles, labels, decisions] = await Promise.all([
    service.getProject(projectId),
    service.getArticles(projectId),
    service.getScreeningLabels(projectId),
    service.getScreeningDecisions(projectId),
  ]);
  return { project, articles, labels, decisions };
}

// Puts back, article by article, the decision each one had at that stage before the change.
function revertTo(
  service: IProjectService,
  previous: ScreeningDecision[],
  articleIds: number[],
  stage: ScreeningStage,
) {
  return async () => {
    const undecided = articleIds.filter((id) => !previous.some((d) => d.article_id === id));
    if (undecided.length) await service.undecideScreening(undecided, stage);
    for (const d of previous) await service.decideScreening([d.article_id], d.label_id, stage, d.note);
  };
}

function changeText(count: number, label: ScreeningLabel | undefined): string {
  const who = count === 1 ? 'Artigo' : `${count} artigos`;
  if (!label) return `${who} sem decisão`;
  const where = label.kind === 'exclude' || label.kind === 'removed' ? ' (arquivado no projeto)' : '';
  return `${who} em "${label.name}"${where}`;
}

/**
 * A project's systematic review (#49): its articles, labels and decisions, grouped for the page, and the actions
 * that decide, take back and undo. Every action reloads from the database, which applies the archive rule.
 *
 * Usage:
 *   const screening = useScreening(projectId);
 *   await screening.decide([articleId], labelId, 'title');
 */
export function useScreening(projectId: number): ScreeningState {
  const service = useProjectService();
  const [data, setData] = useState<ScreeningData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [lastChange, setLastChange] = useState<ScreeningChange | null>(null);

  const reload = useCallback(async () => {
    setData(await loadScreening(service, projectId));
    setLoading(false);
  }, [service, projectId]);

  useEffect(() => {
    let alive = true;
    loadScreening(service, projectId)
      .then((loaded) => alive && setData(loaded))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [service, projectId]);

  const remember = useCallback(
    (articleIds: number[], stage: ScreeningStage, text: string) => {
      const previous = articleIds.map((id) => decisionAt(data.decisions, id, stage)).filter((d) => d !== null);
      const undo = revertTo(service, previous, articleIds, stage);
      const takeBack = async () => {
        await undo();
        setLastChange(null);
        await reload();
      };
      setLastChange({ text, undo: takeBack });
    },
    [data.decisions, service, reload],
  );

  const decide = useCallback(
    async (articleIds: number[], labelId: number, stage: ScreeningStage, note?: string | null) => {
      remember(
        articleIds,
        stage,
        changeText(
          articleIds.length,
          data.labels.find((l) => l.id === labelId),
        ),
      );
      await service.decideScreening(articleIds, labelId, stage, note ?? null);
      await reload();
    },
    [remember, data.labels, service, reload],
  );

  const undecide = useCallback(
    async (articleIds: number[], stage: ScreeningStage) => {
      remember(articleIds, stage, changeText(articleIds.length, undefined));
      await service.undecideScreening(articleIds, stage);
      await reload();
    },
    [remember, service, reload],
  );

  const view = useMemo(() => buildReview(data.articles, data.labels, data.decisions), [data]);
  const dismissChange = useCallback(() => setLastChange(null), []);
  return { ...data, loading, view, lastChange, reload, decide, undecide, dismissChange };
}
