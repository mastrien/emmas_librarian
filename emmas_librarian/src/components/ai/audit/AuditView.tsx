import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, InvestigationResult, ResultReview } from '../../../types';
import type { InvestigationHistoryRecord } from '../../modals/AIExtractionModal';
import { auditStats, drawStratifiedSample } from '../../../utils/auditSampling';
import { auditQuestionRows, sampledInOrder } from '../../../utils/auditQuestions';
import { evidencesOf, type AuditEvidenceItem } from '../../../utils/auditEvidence';
import { parseJsonList } from '../../../utils/parseJsonList';
import { readerStateForAudit } from '../../../utils/auditReturn';
import { useInvestigationAudit } from './useInvestigationAudit';
import { AuditSetup } from './AuditSetup';
import { AuditEstimate } from './AuditEstimate';
import { AuditQuestionTable } from './AuditQuestionTable';
import { AuditEvidencePanel } from './AuditEvidencePanel';
import { AuditQueue } from './AuditQueue';
import { AuditModelComparison } from './AuditModelComparison';
import { AuditHelpDialog } from './AuditHelpDialog';
import './audit.css';

export interface AuditViewProps {
  investigation: InvestigationHistoryRecord;
  projectId?: number;
  articles: Article[];
  results: InvestigationResult[];
  history: InvestigationHistoryRecord[];
  getInvestigationResults: (investigationId: number) => Promise<InvestigationResult[]>;
  onReview: (resultId: number, review: ResultReview) => Promise<void>;
  onBack: () => void;
  /** The item to show first, when coming back from the PDF reader. */
  initialResultId?: number;
}

// A, E and R mark the item in view and P opens its first evidence; never while typing.
function useAuditKeys(handle: (key: 'a' | 'e' | 'r' | 'p') => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || /INPUT|TEXTAREA|SELECT/.test(target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'a' && key !== 'e' && key !== 'r' && key !== 'p') return;
      e.preventDefault();
      handle(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handle]);
}

/**
 * The audit of an investigation by stratified sample (#48): the estimate, the table per question with the evidence
 * panel, the review queue and the comparison between models. Prototype: https://claude.ai/artifact/WFaJacvtFbUuW9mv1Zuatx
 *
 * Usage:
 *   <AuditView investigation={inv} projectId={1} articles={articles} results={results} history={history} ... />
 */
export const AuditView: React.FC<AuditViewProps> = (props) => {
  const { investigation, projectId, articles, results, onReview, onBack, initialResultId } = props;
  const navigate = useNavigate();
  const { audit, loading, draw, modelRows } = useInvestigationAudit({ investigationId: investigation.id, ...props });
  const [view, setView] = useState<'table' | 'queue'>('table');
  const [selectedId, setSelectedId] = useState<number | null>(initialResultId ?? null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const params = audit && {
    seed: audit.seed,
    samplePercent: audit.sample_percent,
    minPerQuestion: audit.min_per_question,
  };
  const rows = useMemo(() => {
    const sample = params ? drawStratifiedSample(results, params) : new Set<number>();
    return auditQuestionRows(parseJsonList<string>(investigation.questions), results, sample);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, audit, investigation.questions]);
  const sampled = sampledInOrder(rows);
  const nextPending = sampled.find((r) => r.review_status === 'pending') ?? null;
  const inView = view === 'queue' ? nextPending : (sampled.find((r) => r.id === selectedId) ?? null);
  const questionOf = (r: InvestigationResult | null) => rows.find((row) => row.question === r?.question)?.number;
  const articleOf = (r: InvestigationResult | null) => articles.find((a) => a.id === r?.article_id);

  // Coming back from the reader, the item's question starts open (derived, so no state is synced in an effect).
  const [toggledAny, setToggledAny] = useState(false);
  const initialQuestion = questionOf(sampled.find((r) => r.id === initialResultId) ?? null);
  const openQuestions = !toggledAny && initialQuestion ? new Set(open).add(initialQuestion) : open;

  const review = (r: InvestigationResult | null) => (v: ResultReview) => r && onReview(r.id, v);
  const openEvidence = (r: InvestigationResult) => (evidence: AuditEvidenceItem) =>
    navigate(`/articles/${r.article_id}`, {
      state: readerStateForAudit(evidence, {
        projectId: projectId ?? 0,
        investigationId: investigation.id,
        resultId: r.id,
      }),
    });

  useAuditKeys((key) => {
    if (!inView || editing) return;
    if (key === 'p') {
      const first = evidencesOf(inView)[0];
      if (first) openEvidence(inView)(first);
    } else if (key === 'e') setEditing(true);
    else review(inView)({ status: key === 'a' ? 'accepted' : 'rejected' });
  });

  if (loading) return <div className="audit-empty">Carregando auditoria...</div>;

  return (
    <div className="audit">
      <div className="audit-row audit-spread" style={{ alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
            ← Voltar à investigação
          </button>
          <h3 style={{ margin: 0 }}>Auditoria da investigação #{investigation.id}</h3>
          <span className="audit-muted" style={{ fontSize: '0.8rem' }}>
            {investigation.model_used || 'Modelo desconhecido'} · {rows.length} perguntas · amostra de {sampled.length}{' '}
            itens
          </span>
        </div>
        <AuditSetup key={audit?.id ?? 'new'} audit={audit} onDraw={(p) => void draw(p)} />
      </div>

      {!audit ? (
        <div className="audit-panel audit-empty">
          Escolha o percentual e o mínimo por pergunta e sorteie a amostra. Cada pergunta entra com pelo menos um item,
          e a semente fica guardada para o mesmo sorteio poder ser repetido.
        </div>
      ) : (
        <>
          <AuditEstimate
            stats={auditStats(sampled)}
            onReviewInSequence={() => setView('queue')}
            onHelp={() => setHelpOpen(true)}
          />
          {view === 'queue' ? (
            <AuditQueue
              current={nextPending}
              pending={sampled.filter((r) => r.review_status === 'pending').length}
              questionNumber={questionOf(nextPending)}
              article={articleOf(nextPending)}
              editing={editing}
              onEdit={setEditing}
              onReview={review(nextPending)}
              onOpenEvidence={nextPending ? openEvidence(nextPending) : () => undefined}
              onBack={() => setView('table')}
            />
          ) : (
            <div className="audit-split">
              <AuditQuestionTable
                rows={rows}
                articles={articles}
                open={openQuestions}
                selectedId={selectedId}
                onToggle={(n) => {
                  setOpen(toggled(openQuestions, n));
                  setToggledAny(true);
                }}
                onSelect={(id) => {
                  setSelectedId(id);
                  setEditing(false);
                }}
              />
              <AuditEvidencePanel
                result={inView}
                questionNumber={questionOf(inView)}
                article={articleOf(inView)}
                editing={editing}
                onEdit={setEditing}
                onReview={review(inView)}
                onOpenEvidence={inView ? openEvidence(inView) : () => undefined}
              />
            </div>
          )}
          <AuditModelComparison rows={modelRows} currentId={investigation.id} onHelp={() => setHelpOpen(true)} />
          <div className="audit-foot">
            <span>Correto = aceita; corrigido e incorreto contam como erro.</span>
            <span>Só os itens sorteados entram na taxa.</span>
            <span>Intervalo de Wilson, 95%.</span>
          </div>
        </>
      )}
      {helpOpen && <AuditHelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
};

function toggled(set: Set<number>, n: number): Set<number> {
  const next = new Set(set);
  if (next.has(n)) next.delete(n);
  else next.add(n);
  return next;
}
