import React, { useEffect, useMemo, useState } from 'react';
import type { PrismaImageFormat, PrismaManualCount, SearchHistoryItem } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import { describeError } from '../../../utils/describeError';
import { PRISMA_ORDER, prismaFlow, type PrismaBoxKey, type PrismaFlow } from '../../../utils/prismaFlow';
import type { ScreeningState } from '../useScreening';
import { PrismaDiagram, SCREEN_PALETTE } from './PrismaDiagram';
import { PrismaPanel } from './PrismaPanel';
import { prismaLayout } from './prismaLayout';
import { exportPrismaDiagram } from './prismaExport';
import { ExportMenu } from './ExportMenu';

// The searches and hand-typed numbers the diagram needs besides the screening data.
function usePrismaSources(projectId: number) {
  const service = useProjectService();
  const [searches, setSearches] = useState<SearchHistoryItem[]>([]);
  const [manual, setManual] = useState<PrismaManualCount[]>([]);
  // The diagram waits for both: drawn without the searches, every step would wrongly "não fecha" for a moment.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([service.getSearchHistory(projectId), service.getPrismaManualCounts(projectId)]).then(
      ([foundSearches, foundManual]) => {
        if (!alive) return;
        setSearches(foundSearches);
        setManual(foundManual);
        setLoaded(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [service, projectId]);
  const saveManual = async (value: number | null) =>
    setManual(await service.setPrismaManualCount(projectId, 'other_sources', value));
  return { searches, manual, saveManual, loaded };
}

const WarningChips: React.FC<{ flow: PrismaFlow }> = ({ flow }) => {
  const all = PRISMA_ORDER.flatMap((k) => flow[k].warnings);
  const count = (kind: string) => all.filter((w) => w.kind === kind).length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
      <span className="review-chip review-chip--maybe">{count('mismatch')} não fecham</span>
      <span className="review-chip review-chip--maybe">{count('partial')} podem ser parciais</span>
      <span className="review-chip review-chip--removed">{count('nodata')} sem dados para conferir</span>
      <span className="review-muted">Clique numa caixa para ver de onde vem o número.</span>
    </div>
  );
};

const DataTable: React.FC<{ flow: PrismaFlow }> = ({ flow }) => (
  <section aria-label="Tabela de dados" className="review-section" style={{ padding: '1rem 0.5rem 0.5rem' }}>
    <h2 style={{ margin: '0 0.75rem 0.6rem', fontSize: '1.05rem' }}>
      Tabela de dados <span className="review-muted">vai junto na exportação</span>
    </h2>
    <div style={{ overflowX: 'auto' }}>
      <table className="prisma-table">
        <thead>
          <tr>
            <th>Caixa</th>
            <th>n</th>
            <th>De onde vem</th>
            <th>Aviso</th>
          </tr>
        </thead>
        <tbody>
          {PRISMA_ORDER.map((key) => (
            <tr key={key}>
              <td>{flow[key].title}</td>
              <td>{flow[key].n}</td>
              <td className="review-muted">{flow[key].how}</td>
              <td>{flow[key].warnings.map((w) => w.text).join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

function useExport(projectId: number, flow: PrismaFlow) {
  const service = useProjectService();
  const [message, setMessage] = useState<string | null>(null);
  const run = async (format: PrismaImageFormat) => {
    try {
      const saved = await exportPrismaDiagram(service, projectId, format, flow);
      setMessage(saved ? `Diagrama salvo em ${saved}, com a tabela de dados ao lado.` : null);
    } catch (err) {
      setMessage(`Não foi possível exportar: ${describeError(err)}`);
    }
  };
  return { message, run };
}

/**
 * The "Diagrama PRISMA" tab of the review page (#50): the diagram built from the project's data, a panel saying
 * where the selected box's number comes from, the data table and the export as SVG or PNG with the table.
 *
 * @example <PrismaTab projectId={3} screening={screening} />
 */
export const PrismaTab: React.FC<{ projectId: number; screening: ScreeningState }> = ({ projectId, screening }) => {
  const { searches, manual, saveManual, loaded } = usePrismaSources(projectId);
  const [selected, setSelected] = useState<PrismaBoxKey>('identified');
  const flow = useMemo(
    () =>
      prismaFlow({
        searches,
        articles: screening.articles,
        labels: screening.labels,
        decisions: screening.decisions,
        manual,
      }),
    [searches, screening.articles, screening.labels, screening.decisions, manual],
  );
  const layout = useMemo(() => prismaLayout(flow), [flow]);
  const exporting = useExport(projectId, flow);
  if (!loaded) return <div className="review-muted">Carregando o diagrama…</div>;
  return (
    <>
      <div className="review-list-head">
        <WarningChips flow={flow} />
        <ExportMenu onPick={(format) => void exporting.run(format)} />
      </div>
      {exporting.message && (
        <div role="status" className="review-counts">
          {exporting.message}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.1rem', alignItems: 'flex-start' }}>
        <div className="review-section prisma-canvas">
          <PrismaDiagram layout={layout} palette={SCREEN_PALETTE} selected={selected} onSelect={setSelected} />
        </div>
        <PrismaPanel
          box={flow[selected]}
          flow={flow}
          articles={screening.articles}
          manual={manual.find((m) => m.count_key === 'other_sources') ?? null}
          onSetManual={saveManual}
        />
      </div>
      <DataTable flow={flow} />
    </>
  );
};
