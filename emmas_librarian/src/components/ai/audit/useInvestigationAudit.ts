import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InvestigationAudit, InvestigationResult } from '../../../types';
import type { InvestigationHistoryRecord } from '../../modals/AIExtractionModal';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { AuditParams } from '../../../utils/auditSampling';
import { modelAuditRows, type ModelAuditRow } from '../../../utils/auditModels';

interface AuditSources {
  investigationId: number;
  projectId?: number;
  /** The live results of this investigation: marks made on screen show up at once. */
  results: InvestigationResult[];
  history: InvestigationHistoryRecord[];
  getInvestigationResults: (investigationId: number) => Promise<InvestigationResult[]>;
}

export interface InvestigationAuditState {
  audit: InvestigationAudit | null;
  loading: boolean;
  draw: (params: AuditParams) => Promise<void>;
  modelRows: ModelAuditRow[];
}

// The other audited investigations of the project, with their results, for the comparison between models.
async function loadOtherAudits(sources: AuditSources, service: ReturnType<typeof useProjectService>) {
  if (!sources.projectId)
    return { audits: [] as InvestigationAudit[], results: new Map<number, InvestigationResult[]>() };
  const audits = await service.getInvestigationAuditsByProject(sources.projectId);
  const others = audits.filter((a) => a.investigation_id !== sources.investigationId);
  const loaded = await Promise.all(others.map((a) => sources.getInvestigationResults(a.investigation_id)));
  return { audits, results: new Map(others.map((a, i) => [a.investigation_id, loaded[i] ?? []])) };
}

/**
 * The audit of one investigation (#48): its stored draw, a way to draw (again), and the rows comparing it with the
 * project's other audited investigations.
 *
 * Usage:
 *   const { audit, draw, modelRows } = useInvestigationAudit({ investigationId, projectId, results, history, getInvestigationResults });
 */
export function useInvestigationAudit(sources: AuditSources): InvestigationAuditState {
  const service = useProjectService();
  const [audit, setAudit] = useState<InvestigationAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [others, setOthers] = useState<{ audits: InvestigationAudit[]; results: Map<number, InvestigationResult[]> }>();
  const { investigationId } = sources;

  useEffect(() => {
    let alive = true;
    service
      .getInvestigationAudit(investigationId)
      .then((found) => alive && setAudit(found))
      .finally(() => alive && setLoading(false));
    loadOtherAudits(sources, service).then((loaded) => alive && setOthers(loaded));
    return () => {
      alive = false;
    };
    // The audit is loaded once per investigation; live marks come through `results`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigationId, service]);

  const draw = useCallback(
    async (params: AuditParams) => setAudit(await service.saveInvestigationAudit(investigationId, params)),
    [service, investigationId],
  );

  const modelRows = useMemo(() => {
    const audits = [
      ...(others?.audits ?? []).filter((a) => a.investigation_id !== investigationId),
      ...(audit ? [audit] : []),
    ];
    const results = new Map(others?.results ?? []);
    results.set(investigationId, sources.results);
    return modelAuditRows(
      sources.history,
      audits.sort((a, b) => a.investigation_id - b.investigation_id),
      results,
    );
  }, [others, audit, investigationId, sources.results, sources.history]);

  return { audit, loading, draw, modelRows };
}
