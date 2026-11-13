import React, { useEffect, useMemo, useState } from 'react';
import type { Article, PrismaImageFormat, PrismaRecords, SearchHistoryItem } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import { describeError } from '../../../utils/describeError';
import { PageHeader } from '../../../components/common/PageHeader';
import { buildReview } from '../../../utils/screeningView';
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
import { PrismaStatusBar } from './PrismaStatusBar';
import './prisma.css';

// "Tabela de dados" (board 166) takes the person to the two tables under the diagram.
const TABLES_ID = 'prisma-tables';
const scrollToTables = () => document.getElementById(TABLES_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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

function useExport(projectId: number, input: PrismaInput, flow: PrismaFlow) {
  const service = useProjectService();
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const run = async (format: PrismaImageFormat) => {
    try {
      const tables = prismaTables(input, flow, prismaOrder(flow));
      const saved = await exportPrismaDiagram(service, projectId, { format, flow, tables, today: new Date() });
      setMessage(saved ? { text: `Diagrama salvo em ${saved}, com as duas tabelas ao lado.`, failed: false } : null);
    } catch (err) {
      setMessage({ text: `Não foi possível exportar: ${describeError(err)}`, failed: true });
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
  const [selected, setSelected] = useState<PrismaBoxKey | null>('identified');
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
  const layout = useMemo(() => prismaLayout(flow, new Date(), { screen: true }), [flow]);
  const exporting = useExport(projectId, input, flow);
  const { articles, labels, decisions } = screening;
  const waiting = useMemo(
    () =>
      buildReview(articles, labels, decisions, 'title').counts.pending +
      buildReview(articles, labels, decisions, 'full').counts.pending,
    [articles, labels, decisions],
  );
  if (!loaded) return <div className="review-muted">Carregando o diagrama…</div>;
  const box = selected && order.includes(selected) ? flow[selected] : null;
  return (
    <>
      <PageHeader
        eyebrow="Revisão sistemática"
        title="Diagrama PRISMA 2020"
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={() => scrollToTables()}>
              Tabela de dados
            </button>
            <ExportMenu onPick={(format) => void exporting.run(format)} />
          </>
        }
      />
      <PrismaStatusBar flow={flow} order={order} waiting={waiting} />
      {/* A plain line under the export button, not a boxed banner (validation of epic #44). */}
      {exporting.message && (
        <p
          role="status"
          className={`prisma-export-note${exporting.message.failed ? ' prisma-export-note--failed' : ''}`}
        >
          {exporting.message.text}
        </p>
      )}
      <div className="prisma-columns">
        <div className="prisma-canvas">
          <PrismaDiagram layout={layout} palette={SCREEN_PALETTE} selected={box?.key ?? null} onSelect={setSelected} />
        </div>
        {box && (
          <PrismaPanel
            box={box}
            flow={flow}
            articles={screening.articles}
            records={records}
            viaOf={viaFrom(searches)}
            actions={actions}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      <div id={TABLES_ID}>
        <DataTable flow={flow} order={order} />
      </div>
      <ExcludedTable reports={excludedReports(input, flow)} />
    </>
  );
};
