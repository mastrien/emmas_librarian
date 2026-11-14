import React, { useEffect, useState } from 'react';
import { ChevronsRight } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { SideDrawer } from '../../components/common/SideDrawer';
import { IndexRecalculationModal } from '../../components/modals/IndexRecalculationModal';
import { QuotaModal } from '../../components/modals/QuotaModal';
import { useInvestigationRunContext } from '../../contexts/InvestigationRunContext';
import { useFillWindowHeight } from '../../hooks/useFillWindowHeight';
import { useNarrowWindow } from '../../hooks/useNarrowWindow';
import { InvestigationDetail } from './InvestigationDetail';
import { InvestigationNavList } from './InvestigationNavList';
import { RunningView } from './RunningView';
import { NewInvestigationView, type InvestigationDraft } from './NewInvestigationView';
import { investigationPath } from './investigationView';
import { useInvestigationPageData } from './useInvestigationPageData';
import { useRecalculationBeforeRun } from './useRecalculationBeforeRun';
import './investigation.css';
import { fillHeightStyle } from '../../hooks/useFillWindowHeight';
import { PageHeader } from '../../components/common/PageHeader';
import { ProjectNavPortal } from '../../components/common/shell/projectNavSlot';

// The project sidebar folds to icons at this width (shell.css); the investigations then go to a drawer.
const SIDEBAR_FOLDS_PX = 1199;

const NEW_SUBTITLE = 'Perguntas feitas a cada PDF. Cada resposta vem com a página de onde saiu.';

/**
 * The mass investigation as a page of the project (#73), out of the modal it had outgrown: a new one, the one
 * running or a stored one with its answers, calls and audit. It narrows the side margins, since the answers grid uses every pixel. The list of investigations lives in the project
 * sidebar (board 159). Prototype:
 * https://claude.ai/artifact/QHAWxKuRzQPB53reaG1qtX
 *
 * @example <Route path="/projects/:id/investigation/:view" element={<InvestigationPage />} />
 */
export const InvestigationPage: React.FC = () => {
  const params = useParams<{ id: string; view?: string }>();
  const projectId = Number(params.id);
  const view = params.view;
  const navigate = useNavigate();
  const folded = useNarrowWindow(SIDEBAR_FOLDS_PX);
  const { setPage, height } = useFillWindowHeight();
  const { run, start, cancel, dismiss, dismissQuota } = useInvestigationRunContext();
  const ownRun = run?.projectId === projectId ? run : null;
  const data = useInvestigationPageData(projectId, ownRun?.savedId ?? null);
  const recalculation = useRecalculationBeforeRun();
  const [draftEdits, setDraft] = useState<InvestigationDraft | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const articlesWithPdf = data.articles.filter((a) => !!a.local_file_path);
  const draft = draftEdits ?? { questions: [''], selectedIds: articlesWithPdf.map((a) => a.id) };

  // The run finished while on its view: show what it saved. Elsewhere, the list just gains the new investigation.
  useEffect(() => {
    if (view !== 'running' || !ownRun || ownRun.isRunning || ownRun.quotaHit) return;
    const saved = ownRun.savedId;
    // Waits for the list to hold what was saved: opening it sooner would land on another investigation.
    if (saved !== null && !data.history.some((h) => h.id === saved)) return;
    dismiss();
    navigate(investigationPath(projectId, saved ?? 'new'), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the end of the run
  }, [view, ownRun?.isRunning, ownRun?.quotaHit, data.history]);

  if (data.loading) return <div className="inv-empty">Carregando…</div>;
  if (!data.project) return <div className="inv-empty">Projeto não encontrado.</div>;

  const opened = data.history.find((h) => String(h.id) === view);
  if (!view || (view !== 'new' && view !== 'running' && !opened)) {
    const landing = ownRun?.isRunning ? 'running' : (data.history[0]?.id ?? 'new');
    return <Navigate to={investigationPath(projectId, landing)} replace state={null} />;
  }
  if (view === 'running' && !ownRun) return <Navigate to={investigationPath(projectId)} replace />;

  const reExecute = (questions: string[], selectedIds: number[]) => {
    setDraft({ questions, selectedIds });
    navigate(investigationPath(projectId, 'new'));
  };
  const runDraft = () => {
    void start({ projectId, articles: data.articles, questions: draft.questions, selectedIds: draft.selectedIds });
    setDraft(null);
    navigate(investigationPath(projectId, 'running'));
  };
  const begin = () => void recalculation.check(draft.selectedIds, runDraft);
  const leaveNew = () => navigate(investigationPath(projectId));
  const navList = (
    <InvestigationNavList
      projectId={projectId}
      history={data.history}
      run={run}
      pendingById={data.pendingById}
      auditedIds={data.auditedIds}
      onPick={() => setDrawerOpen(false)}
    />
  );

  return (
    <div ref={setPage} className="inv-page" style={fillHeightStyle(height)} data-testid="investigation-page">
      {/* The list lives under "Investigação com IA" in the project sidebar (board 159); a drawer on a folded one. */}
      {!folded && <ProjectNavPortal>{navList}</ProjectNavPortal>}
      {folded && (
        <button type="button" className="btn-ghost inv-drawer-button" onClick={() => setDrawerOpen(true)}>
          <ChevronsRight size={16} aria-hidden="true" /> Investigações ({data.history.length})
        </button>
      )}
      {folded && drawerOpen && (
        <SideDrawer side="left" label="Investigações do projeto" onClose={() => setDrawerOpen(false)}>
          {navList}
        </SideDrawer>
      )}
      <div className="inv-main">
        {view === 'new' && (
          <>
            <PageHeader title="Nova investigação" subtitle={NEW_SUBTITLE} />
            <NewInvestigationView
              projectId={projectId}
              articlesWithPdf={articlesWithPdf}
              searchHistory={data.searchHistory}
              lastInvestigation={data.history[0]}
              draft={draft}
              onDraftChange={setDraft}
              modelLabel={data.modelLabel}
              busy={!!run?.isRunning || recalculation.checking}
              onStart={begin}
              onCancel={leaveNew}
            />
          </>
        )}
        {view === 'running' && ownRun && (
          <RunningView
            run={ownRun}
            modelLabel={data.modelLabel}
            onCancel={cancel}
            onLeave={() => navigate(`/projects/${projectId}/articles`)}
          />
        )}
        {opened && (
          <InvestigationDetail
            key={opened.id}
            projectId={projectId}
            investigation={opened}
            articles={data.articles}
            history={data.history}
            onReExecute={reExecute}
            onPendingChanged={data.setPending}
          />
        )}
      </div>
      <QuotaModal isOpen={!!ownRun?.quotaHit} onClose={dismissQuota} />
      {recalculation.plan && (
        <IndexRecalculationModal
          plan={recalculation.plan}
          running={recalculation.running}
          confirmLabel="Recalcular e investigar"
          onConfirm={() => void recalculation.confirm()}
          onClose={recalculation.dismiss}
        />
      )}
    </div>
  );
};
