import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, InvestigationResult, ResultReview } from '../../../types';
import type { InvestigationHistoryRecord } from '../../../types';
import { SideDrawer } from '../../common/SideDrawer';
import { useNarrowWindow } from '../../../hooks/useNarrowWindow';
import { auditStats, drawStratifiedSample } from '../../../utils/auditSampling';
import { auditQuestionRows, sampledInOrder } from '../../../utils/auditQuestions';
import { evidencesOf, type AuditEvidenceItem } from '../../../utils/auditEvidence';
import { parseJsonList } from '../../../utils/parseJsonList';
import { readerStateForAudit, readerStateForAuditArticle } from '../../../utils/auditReturn';
import { useInvestigationAudit } from './useInvestigationAudit';
import { AuditSetup } from './AuditSetup';
import { AuditEstimate } from './AuditEstimate';
import { AuditQuestionTable } from './AuditQuestionTable';
import { AuditEvidencePanel } from './AuditEvidencePanel';
import { AuditSampleList } from './AuditSampleList';
import { AuditModelComparison } from './AuditModelComparison';
import { AuditHelpDialog } from './AuditHelpDialog';
import './audit.css';
import './auditLayout.css';

export interface AuditViewProps {
  investigation: InvestigationHistoryRecord;
  projectId?: number;
  articles: Article[];
  results: InvestigationResult[];
  history: InvestigationHistoryRecord[];
  getInvestigationResults: (investigationId: number) => Promise<InvestigationResult[]>;
  onReview: (resultId: number, review: ResultReview) => Promise<void>;
  /** The item to show first, when coming back from the PDF reader. */
  initialResultId?: number;
}

// A, E and R mark the item in view and P opens its first evidence, or its PDF when it cited nothing; never while typing.
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

// Which item is in the middle (board 163): the one picked, else the first pending one, so the audit is a review in
// sequence by default. On a narrow window nothing is picked for the person: the item opens over the page, as a drawer.
function useAuditSelection(sampled: InvestigationResult[], initialResultId: number | undefined, narrow: boolean) {
  const [selectedId, setSelectedId] = useState<number | null>(initialResultId ?? null);
  const firstPending = sampled.find((r) => r.review_status === 'pending') ?? null;
  const fallback = narrow ? null : (firstPending ?? sampled[0] ?? null);
  const inView = sampled.find((r) => r.id === selectedId) ?? fallback;
  // After a verdict the next pending item after this one comes up; nothing left after it, the first one left.
  const advanceFrom = (resultId: number) => {
    const from = sampled.findIndex((r) => r.id === resultId);
    const pending = (r: InvestigationResult) => r.review_status === 'pending' && r.id !== resultId;
    const next = sampled.slice(from + 1).find(pending) ?? sampled.find(pending);
    if (next) setSelectedId(next.id);
  };
  return { inView, setSelectedId, advanceFrom, allMarked: sampled.length > 0 && !firstPending };
}

/**
 * The audit of an investigation by stratified sample (#48), in three columns (board 163): the drawn items on the
 * left, the one in view in the middle with its evidence and verdict, and on the right the estimate, the rates per
 * question and the comparison between models. Prototype: https://claude.ai/artifact/WFaJacvtFbUuW9mv1Zuatx
 *
 * Usage:
 *   <AuditView investigation={inv} projectId={1} articles={articles} results={results} history={history} ... />
 */
export const AuditView: React.FC<AuditViewProps> = (props) => {
  const { investigation, projectId, articles, results, onReview, initialResultId } = props;
  const narrow = useNarrowWindow();
  const navigate = useNavigate();
  const { audit, loading, draw, modelRows } = useInvestigationAudit({ investigationId: investigation.id, ...props });
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
  const selection = useAuditSelection(sampled, initialResultId, narrow);
  const { inView } = selection;
  const questionOf = (r: InvestigationResult | null) => rows.find((row) => row.question === r?.question)?.number;
  const articleOf = (r: InvestigationResult | null) => articles.find((a) => a.id === r?.article_id);

  const review = (r: InvestigationResult | null) => (v: ResultReview) => {
    if (!r) return;
    void onReview(r.id, v);
    if (v.status !== 'pending') selection.advanceFrom(r.id);
  };
  const openEvidence = (r: InvestigationResult) => (evidence: AuditEvidenceItem) =>
    navigate(`/articles/${r.article_id}`, {
      state: readerStateForAudit(evidence, {
        projectId: projectId ?? 0,
        investigationId: investigation.id,
        resultId: r.id,
      }),
    });

  // An answer that cited nothing can only be checked in the PDF, so P opens it (validation of epic #44).
  const openArticle = (r: InvestigationResult | null) => {
    if (!r || !articleOf(r)?.local_file_path) return undefined;
    return () =>
      navigate(`/articles/${r.article_id}`, {
        state: readerStateForAuditArticle({
          projectId: projectId ?? 0,
          investigationId: investigation.id,
          resultId: r.id,
        }),
      });
  };

  useAuditKeys((key) => {
    if (!inView || editing) return;
    if (key === 'p') {
      const first = evidencesOf(inView)[0];
      if (first) openEvidence(inView)(first);
      else openArticle(inView)?.();
    } else if (key === 'e') setEditing(true);
    else review(inView)({ status: key === 'a' ? 'accepted' : 'rejected' });
  });

  if (loading) return <div className="audit-empty">Carregando auditoria...</div>;

  const evidencePanel = (
    <AuditEvidencePanel
      result={inView}
      questionNumber={questionOf(inView)}
      article={articleOf(inView)}
      editing={editing}
      onEdit={setEditing}
      onReview={review(inView)}
      onOpenEvidence={inView ? openEvidence(inView) : () => undefined}
      onOpenArticle={openArticle(inView)}
    />
  );

  return (
    <div className="audit">
      <div className="audit-toolbar">
        <span className="audit-muted audit-text-sm">
          {investigation.model_used || 'Modelo desconhecido'} · {rows.length} perguntas · amostra de {sampled.length}{' '}
          itens
        </span>
        <AuditSetup key={audit?.id ?? 'new'} audit={audit} onDraw={(p) => void draw(p)} />
        <button type="button" className="btn-ghost" onClick={() => setHelpOpen(true)}>
          Como ler
        </button>
      </div>

      {!audit ? (
        <div className="audit-panel audit-empty">
          Escolha o percentual e o mínimo por pergunta e sorteie a amostra. Cada pergunta entra com pelo menos um item,
          e a semente fica guardada para o mesmo sorteio poder ser repetido.
        </div>
      ) : (
        <div className="audit-columns">
          <AuditSampleList
            sampled={sampled}
            questionNumberOf={questionOf}
            articles={articles}
            currentId={inView?.id ?? null}
            onSelect={(id) => {
              selection.setSelectedId(id);
              setEditing(false);
            }}
          />
          <div className="audit-center">
            {!narrow && evidencePanel}
            {selection.allMarked && (
              <div className="audit-callout" role="status">
                <strong>Amostra toda marcada</strong>
                <span className="audit-muted">A estimativa ao lado já é o resultado desta auditoria.</span>
              </div>
            )}
          </div>
          <div className="audit-right">
            <AuditEstimate stats={auditStats(sampled)} onHelp={() => setHelpOpen(true)} />
            <AuditQuestionTable rows={rows} />
            <AuditModelComparison rows={modelRows} currentId={investigation.id} onHelp={() => setHelpOpen(true)} />
            <div className="audit-foot">
              <span>Correto = aceita; corrigido e incorreto contam como erro.</span>
              <span>Só os itens sorteados entram na taxa.</span>
              <span>Intervalo de Wilson, 95%.</span>
            </div>
          </div>
        </div>
      )}
      {helpOpen && <AuditHelpDialog onClose={() => setHelpOpen(false)} />}
      {narrow && inView && (
        <SideDrawer side="right" label="Item da amostra" onClose={() => selection.setSelectedId(null)}>
          {evidencePanel}
        </SideDrawer>
      )}
    </div>
  );
};
