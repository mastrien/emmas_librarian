import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Article, ScreeningStage } from '../../types';
import { useScreening } from './useScreening';
import { useGuidedScreening, type GuidedScreening } from './useGuidedScreening';
import { GuidedDecisionPanel } from './GuidedDecisionPanel';
import { articleMeta, databasesOf } from './reviewText';
import './review.css';

const STAGES: { id: ScreeningStage; label: string }[] = [
  { id: 'title', label: 'Título e resumo' },
  { id: 'full', label: 'Texto completo' },
];

const StageTabs: React.FC<{ guided: GuidedScreening }> = ({ guided }) => (
  <div
    role="tablist"
    aria-label="Etapa"
    style={{
      display: 'flex',
      gap: '2px',
      padding: '3px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-main)',
      border: '1px solid var(--border-color)',
    }}
  >
    {STAGES.map((s) => (
      <button
        key={s.id}
        type="button"
        role="tab"
        aria-selected={guided.stage === s.id}
        className="review-quiet"
        onClick={() => guided.setStage(s.id)}
        style={guided.stage === s.id ? { background: 'var(--bg-surface)', fontWeight: 600 } : undefined}
      >
        {s.label}
      </button>
    ))}
  </div>
);

const ProgressLine: React.FC<{ guided: GuidedScreening }> = ({ guided }) => {
  const total = guided.poolSize || 1;
  const width = (n: number) => `${(n / total) * 100}%`;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', alignItems: 'center' }}>
      <strong>
        {guided.queue.length ? `Artigo ${guided.position + 1} de ${guided.queue.length}` : 'Nenhum artigo nesta etapa'}
      </strong>
      <div
        aria-hidden="true"
        style={{
          flex: '1 1 240px',
          height: '8px',
          borderRadius: '999px',
          background: 'var(--bg-main)',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {(['include', 'maybe', 'exclude', 'removed'] as const).map((kind) => (
          <span key={kind} className={`review-dot--${kind}`} style={{ width: width(guided.tally[kind]) }} />
        ))}
      </div>
      <span className="review-muted">{guided.pending === 1 ? '1 pendente' : `${guided.pending} pendentes`}</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input type="checkbox" checked={guided.onlyPending} onChange={guided.toggleOnlyPending} /> Só pendentes
      </label>
    </div>
  );
};

const ArticleCard: React.FC<{ article: Article; guided: GuidedScreening }> = ({ article, guided }) => (
  <article
    className="review-section"
    style={{
      flex: '999 1 560px',
      minWidth: 0,
      padding: '1.4rem 1.6rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.7rem',
    }}
  >
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
      {databasesOf(article).map((db) => (
        <span key={db} className="review-chip review-chip--none">
          {db}
        </span>
      ))}
    </div>
    <h2 style={{ margin: 0, fontSize: '1.4rem', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{article.title}</h2>
    <span className="review-muted">{articleMeta(article)}</span>
    {guided.stage === 'full' && (
      <div className="review-counts">
        <span>{article.local_file_path ? 'PDF anexado ao artigo.' : 'Sem PDF anexado.'}</span>
        <Link to={`/articles/${article.id}`} className="review-small">
          {article.local_file_path ? 'Abrir PDF' : 'Abrir o artigo'}
        </Link>
      </div>
    )}
    <h3 className="review-menu-title" style={{ padding: 0, marginTop: '0.4rem' }}>
      Resumo
    </h3>
    <p style={{ margin: 0, lineHeight: 1.65, maxWidth: '72ch' }}>{article.abstract || 'Sem resumo cadastrado.'}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
      <button type="button" className="review-small" onClick={() => guided.go(-1)} disabled={guided.position === 0}>
        ← Anterior
      </button>
      <button
        type="button"
        className="review-small"
        onClick={() => guided.go(1)}
        disabled={guided.position >= guided.queue.length - 1}
      >
        Próximo →
      </button>
      <button type="button" className="review-small" onClick={() => void guided.undo()} disabled={!guided.canUndo}>
        Desfazer (Z)
      </button>
    </div>
  </article>
);

const Finished: React.FC<{ guided: GuidedScreening; projectId: number }> = ({ guided, projectId }) => (
  <div
    className="review-section"
    style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', alignItems: 'flex-start' }}
  >
    <h2 style={{ margin: 0 }}>
      {guided.poolSize === 0
        ? 'Nenhum artigo chegou a esta etapa ainda'
        : guided.stage === 'title'
          ? 'Triagem por título e resumo concluída'
          : 'Avaliação do texto completo concluída'}
    </h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      <span className="review-chip review-chip--include">{guided.tally.include} incluídos</span>
      <span className="review-chip review-chip--maybe">{guided.tally.maybe} em dúvida</span>
      <span className="review-chip review-chip--exclude">{guided.tally.exclude} excluídos</span>
      {guided.tally.removed > 0 && (
        <span className="review-chip review-chip--removed">
          {guided.tally.removed} duplicados (removidos antes da triagem)
        </span>
      )}
    </div>
    <p className="review-muted" style={{ margin: 0, maxWidth: '640px', lineHeight: 1.5 }}>
      {guided.stage === 'title'
        ? 'Os incluídos e os em dúvida passam para a etapa de texto completo. Os excluídos já estão arquivados no projeto, com o motivo.'
        : 'Os incluídos aparecem na seção do rótulo na página da revisão; os excluídos ficam arquivados no projeto com o motivo desta etapa.'}
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {guided.stage === 'title' && (
        <button type="button" className="btn-primary" onClick={() => guided.setStage('full')}>
          Ir para texto completo
        </button>
      )}
      {guided.poolSize > 0 && (
        <button type="button" className="btn-secondary" onClick={guided.reviewAll}>
          Rever todos desta etapa
        </button>
      )}
      <Link to={`/projects/${projectId}/review`} className="btn-secondary">
        Voltar à revisão
      </Link>
    </div>
  </div>
);

/**
 * The guided screening (#49): one article at a time, title and abstract first, then full text, with keyboard
 * decisions, a note, undo and a filter of pending articles. Its decisions are the same as the review page's.
 *
 * Usage:
 *   <Route path="/projects/:id/review/guided" element={<GuidedScreeningPage />} />
 */
export const GuidedScreeningPage: React.FC = () => {
  const projectId = Number(useParams<{ id: string }>().id);
  const screening = useScreening(projectId);
  const guided = useGuidedScreening(screening);
  if (screening.loading) return <div className="review review-muted">Carregando a triagem…</div>;
  const article = guided.current;
  return (
    <div className="review fade-in">
      <div className="review-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', alignItems: 'center' }}>
          <Link to={`/projects/${projectId}/review`} className="review-back">
            <ArrowLeft size={18} aria-hidden="true" /> Voltar à revisão
          </Link>
          <h1 className="review-title" style={{ fontSize: '1.4rem' }}>
            Triagem guiada · PRISMA 2020
          </h1>
        </div>
        <StageTabs guided={guided} />
      </div>
      <ProgressLine guided={guided} />
      {guided.finished || !article ? (
        <Finished guided={guided} projectId={projectId} />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.1rem', alignItems: 'flex-start' }}>
          <ArticleCard article={article} guided={guided} />
          <GuidedDecisionPanel
            key={`${guided.stage}-${article.id}`}
            stage={guided.stage}
            options={guided.options}
            duplicate={guided.duplicate}
            decision={guided.decisionHere}
            onDecide={(label, note) => void guided.decide(label, note)}
            onMove={guided.go}
            onUndo={() => void guided.undo()}
          />
        </div>
      )}
    </div>
  );
};

export default GuidedScreeningPage;
