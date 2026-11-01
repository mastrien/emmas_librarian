import React, { useEffect, useMemo, useState } from 'react';
import type { Article, PrismaImageFormat, PrismaRecords, SearchHistoryItem } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import { describeError } from '../../../utils/describeError';
import {
  prismaFlow,
  prismaOrder,
  type PrismaBoxKey,
  type PrismaFlow,
  type PrismaInput,
} from '../../../utils/prismaFlow';
import { excludedReports, prismaTables } from '../../../utils/prisma/prismaTables';
import type { ScreeningState } from '../useScreening';
import { PrismaDiagram, SCREEN_PALETTE } from './PrismaDiagram';
import { PrismaPanel, type PrismaPanelActions } from './PrismaPanel';
import { prismaLayout } from './prismaLayout';
import { exportPrismaDiagram } from './prismaExport';
import { ExportMenu } from './ExportMenu';
import { DataTable, ExcludedTable } from './PrismaTables';

const NO_RECORDS: PrismaRecords = { sources: [], origins: [], studyLinks: [] };

// The history and the PRISMA records the diagram needs besides the screening data, and the actions that change them.
function usePrismaData(projectId: number) {
  const service = useProjectService();
  const [searches, setSearches] = useState<SearchHistoryItem[]>([]);
  const [records, setRecords] = useState<PrismaRecords>(NO_RECORDS);
  // The diagram waits for both: drawn without the searches, every step would wrongly not add up for a moment.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([service.getSearchHistory(projectId), service.getPrismaRecords(projectId)]).then(([s, r]) => {
      if (!alive) return;
      setSearches(s);
      setRecords(r);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [service, projectId]);
  const actions: PrismaPanelActions = {
    saveSource: async (input) => setRecords(await service.savePrismaSource(projectId, input)),
    setOrigins: async (ids, sourceId) => setRecords(await service.setPrismaOrigins(projectId, ids, sourceId)),
    link: async (a, b) => setRecords(await service.linkSameStudy(projectId, a, b)),
    unlink: async (study) => setRecords(await service.unlinkStudy(projectId, study)),
  };
  return { searches, records, actions, loaded };
}

const WarningChips: React.FC<{ flow: PrismaFlow; order: PrismaBoxKey[] }> = ({ flow, order }) => {
  const all = order.flatMap((k) => flow[k].warnings);
  const count = (kind: string) => all.filter((w) => w.kind === kind).length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
      <span className="review-chip review-chip--maybe">{count('pending')} aguardando decisões</span>
      <span className="review-chip review-chip--maybe">{count('mismatch')} com números que não batem</span>
      <span className="review-chip review-chip--maybe">{count('partial')} podem ser parciais</span>
      <span className="review-chip review-chip--removed">{count('nodata')} sem dados para conferir</span>
      <span className="review-muted">Clique numa caixa para ver de onde vem o número.</span>
    </div>
  );
};

function useExport(projectId: number, input: PrismaInput, flow: PrismaFlow) {
  const service = useProjectService();
  const [message, setMessage] = useState<string | null>(null);
  const run = async (format: PrismaImageFormat) => {
    try {
      const tables = prismaTables(input, flow, prismaOrder(flow));
      const saved = await exportPrismaDiagram(service, projectId, { format, flow, tables, today: new Date() });
      setMessage(saved ? `Diagrama salvo em ${saved}, com as duas tabelas ao lado.` : null);
    } catch (err) {
      setMessage(`Não foi possível exportar: ${describeError(err)}`);
    }
  };
  return { message, run };
}

// How an article entered the project, as the history logged it ("Adição manual de artigo avulso: título").
function viaFrom(searches: SearchHistoryItem[]): (article: Article) => string {
  const entries = new Map(searches.map((s) => [s.id, s]));
  return (article) => {
    const entry = article.search_id ? entries.get(article.search_id) : undefined;
    if (!entry) return 'Entrou antes de o app registrar como';
    return entry.unified_query.split(':')[0];
  };
}

/**
 * The "Diagrama PRISMA" tab of the review page (#50): the PRISMA 2020 diagram built from the project's data,
 * with the "other methods" column when articles came from outside the searches, a panel saying where the
 * selected box's number comes from (and where to tell origins and studies), the two tables and the export.
 *
 * @example <PrismaTab projectId={3} screening={screening} />
 */
export const PrismaTab: React.FC<{ projectId: number; screening: ScreeningState }> = ({ projectId, screening }) => {
  const { searches, records, actions, loaded } = usePrismaData(projectId);
  const [selected, setSelected] = useState<PrismaBoxKey>('identified');
  const input = useMemo<PrismaInput>(
    () => ({
      searches,
      articles: screening.articles,
      labels: screening.labels,
      decisions: screening.decisions,
      records,
    }),
    [searches, screening.articles, screening.labels, screening.decisions, records],
  );
  const flow = useMemo(() => prismaFlow(input), [input]);
  const order = prismaOrder(flow);
  const layout = useMemo(() => prismaLayout(flow, new Date()), [flow]);
  const exporting = useExport(projectId, input, flow);
  if (!loaded) return <div className="review-muted">Carregando o diagrama…</div>;
  const box = flow[order.includes(selected) ? selected : 'identified'];
  return (
    <>
      <div className="review-list-head">
        <WarningChips flow={flow} order={order} />
        <ExportMenu onPick={(format) => void exporting.run(format)} />
      </div>
      {exporting.message && (
        <div role="status" className="review-counts">
          {exporting.message}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.1rem', alignItems: 'flex-start' }}>
        <div className="review-section prisma-canvas">
          <PrismaDiagram layout={layout} palette={SCREEN_PALETTE} selected={box.key} onSelect={setSelected} />
        </div>
        <PrismaPanel
          box={box}
          flow={flow}
          articles={screening.articles}
          records={records}
          viaOf={viaFrom(searches)}
          actions={actions}
        />
      </div>
      <DataTable flow={flow} order={order} />
      <ExcludedTable reports={excludedReports(input, flow)} />
    </>
  );
};
