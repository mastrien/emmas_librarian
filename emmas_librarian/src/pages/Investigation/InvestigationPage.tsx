import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowLeft, ChevronsRight, Plus } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { SideDrawer } from '../../components/common/SideDrawer';
import { useInvestigationRunContext } from '../../contexts/InvestigationRunContext';
import { useFillWindowHeight } from '../../hooks/useFillWindowHeight';
import { useNarrowWindow } from '../../hooks/useNarrowWindow';
import { CallsTab } from './CallsTab';
import { InvestigationDetail } from './InvestigationDetail';
import { InvestigationSidebar } from './InvestigationSidebar';
import { NewInvestigationView, type InvestigationDraft } from './NewInvestigationView';
import { investigationPath, liveCalls } from './investigationView';
import { useInvestigationPageData } from './useInvestigationPageData';
import type { InvestigationRunState } from './useInvestigationRun';
import './investigation.css';

const QuotaNotice: React.FC<{ onClose: () => void }> = ({ onClose }) =>
  createPortal(
    <div className="inv-modal-overlay">
      <div className="card fade-in inv-modal" role="alertdialog" aria-label="Limite de Cota Atingido">
        <AlertCircle
          size={48}
          aria-hidden="true"
          style={{ color: 'var(--color-danger)', margin: '0 auto 1rem auto' }}
        />
        <h3 style={{ margin: '0 0 1rem 0' }}>Limite de Cota Atingido</h3>
        <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)' }}>
          A sua chave de API (OpenAI/Anthropic/Gemini) parece ter esgotado o limite de cota ou os créditos disponíveis.
          Verifique o seu provedor de IA e atualize as configurações no sistema.
        </p>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
          Entendi
        </button>
      </div>
    </div>,
    document.body,
  );

const RunningView: React.FC<{ run: InvestigationRunState; onCancel: () => void }> = ({ run, onCancel }) => (
  <>
    <div className="inv-detail-head">
      <div>
        <h2>
          Investigação em andamento{' '}
          <span className="inv-chip inv-chip--run">
            Artigo {run.current} de {run.targets.length}
          </span>
        </h2>
        <div className="inv-muted">As respostas chegam para revisão quando a investigação terminar.</div>
      </div>
      <button type="button" className="btn-secondary inv-small inv-danger" onClick={onCancel}>
        Cancelar
      </button>
    </div>
    <CallsTab cells={liveCalls(run)} questions={run.questions} />
  </>
);

/**
 * The mass investigation as a page of the project (#73), out of the modal it had outgrown: the investigations on
 * one side and, on the other, a new one, the one running or a stored one with its calls, answers and audit. It
 * drops the app's side margins, since the answers grid uses every pixel. Prototype:
 * https://claude.ai/artifact/QHAWxKuRzQPB53reaG1qtX
 *
 * @example <Route path="/projects/:id/investigation/:view" element={<InvestigationPage />} />
 */
export const InvestigationPage: React.FC = () => {
  const params = useParams<{ id: string; view?: string }>();
  const projectId = Number(params.id);
  const view = params.view;
  const navigate = useNavigate();
  const narrow = useNarrowWindow();
  const { setPage, height } = useFillWindowHeight();
  const { run, start, cancel, dismiss, dismissQuota } = useInvestigationRunContext();
  const ownRun = run?.projectId === projectId ? run : null;
  const data = useInvestigationPageData(projectId, ownRun?.savedId ?? null);
  const [draftEdits, setDraft] = useState<InvestigationDraft | null>(null);
  const [collapsed, setCollapsed] = useState(false);
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
  const begin = () => {
    void start({ projectId, articles: data.articles, questions: draft.questions, selectedIds: draft.selectedIds });
    setDraft(null);
    navigate(investigationPath(projectId, 'running'));
  };
  const leaveNew = () => navigate(investigationPath(projectId));
  const sidebar = (inDrawer: boolean) => (
    <InvestigationSidebar
      projectId={projectId}
      history={data.history}
      run={run}
      pendingById={data.pendingById}
      auditedIds={data.auditedIds}
      onCollapse={inDrawer ? undefined : () => setCollapsed(true)}
      onPick={() => setDrawerOpen(false)}
    />
  );

  return (
    <div ref={setPage} className="inv-page" style={{ height }} data-testid="investigation-page">
      <header className="inv-page-head">
        <div style={{ minWidth: 0 }}>
          <Link to={`/projects/${projectId}`} className="inv-back">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar ao projeto
          </Link>
          <h1>Investigação com IA</h1>
          <span className="inv-muted">{data.project.name}</span>
        </div>
        <div className="inv-actions">
          <span className="inv-model">
            Modelo: <strong>{data.modelLabel}</strong> <Link to="/settings">Configurações</Link>
          </span>
          <Link to={investigationPath(projectId, 'new')} className="btn-primary">
            <Plus size={16} aria-hidden="true" /> Nova investigação
          </Link>
        </div>
      </header>
      <div className="inv-body">
        {!narrow && !collapsed && sidebar(false)}
        {(narrow || collapsed) && (
          <button
            type="button"
            className="btn-secondary inv-rail"
            aria-label="Mostrar a lista de investigações"
            onClick={() => (narrow ? setDrawerOpen(true) : setCollapsed(false))}
          >
            <ChevronsRight size={16} aria-hidden="true" /> Investigações ({data.history.length})
          </button>
        )}
        {narrow && drawerOpen && (
          <SideDrawer side="left" label="Investigações do projeto" onClose={() => setDrawerOpen(false)}>
            {sidebar(true)}
          </SideDrawer>
        )}
        <div className="inv-main">
          {view === 'new' && (
            <NewInvestigationView
              projectId={projectId}
              articlesWithPdf={articlesWithPdf}
              searchHistory={data.searchHistory}
              draft={draft}
              onDraftChange={setDraft}
              modelLabel={data.modelLabel}
              busy={!!run?.isRunning}
              onStart={begin}
              onCancel={leaveNew}
            />
          )}
          {view === 'running' && ownRun && <RunningView run={ownRun} onCancel={cancel} />}
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
      </div>
      {ownRun?.quotaHit && <QuotaNotice onClose={dismissQuota} />}
    </div>
  );
};
