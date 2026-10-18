import React from 'react';
import type { Article, InvestigationResult, ResultReview } from '../../../types';
import type { AuditEvidenceItem } from '../../../utils/auditEvidence';
import { aiAnswerText } from '../../../utils/investigationAnswers';
import { AuditEvidenceList } from './AuditEvidence';
import { AuditVerdict } from './AuditVerdict';

export interface AuditQueueProps {
  current: InvestigationResult | null;
  pending: number;
  questionNumber?: number;
  article?: Article;
  editing: boolean;
  onEdit: (open: boolean) => void;
  onReview: (review: ResultReview) => void;
  onOpenEvidence: (evidence: AuditEvidenceItem) => void;
  onBack: () => void;
}

/**
 * The review queue: the next pending item of the sample, its answer and verdict on one side and what the AI cited on
 * the other, so each step is check-then-mark. Keys A, E, R and P work here.
 *
 * Usage:
 *   <AuditQueue current={next} pending={left} ... onBack={() => setView('table')} />
 */
export const AuditQueue: React.FC<AuditQueueProps> = (props) => {
  const { current, pending, questionNumber, article, editing, onEdit, onReview, onOpenEvidence, onBack } = props;
  const head = (
    <div className="audit-row audit-spread">
      <button type="button" className="btn-secondary" onClick={onBack}>
        ← Voltar para a tabela
      </button>
      <span className="audit-muted audit-num" style={{ fontSize: '0.8rem' }}>
        {pending} pendentes na amostra
      </span>
    </div>
  );
  if (!current) {
    return (
      <>
        {head}
        <div className="audit-panel audit-empty">
          <h3 style={{ margin: '0 0 6px' }}>Amostra toda marcada</h3>A estimativa acima já é o resultado desta
          auditoria.
        </div>
      </>
    );
  }
  return (
    <>
      {head}
      <section className="audit-panel audit-queue" aria-label="Revisão em sequência">
        <div>
          <span className="audit-eyebrow">
            P{questionNumber} · {article?.title ?? `Artigo ${current.article_id}`}
          </span>
          <div className="audit-queue-question">{current.question}</div>
          <div>
            <div className="audit-eyebrow" style={{ marginBottom: 4 }}>
              Resposta da IA
            </div>
            <div className="audit-answer" style={{ fontSize: '1.05rem' }}>
              {aiAnswerText(current) || '—'}
            </div>
          </div>
          <AuditVerdict result={current} editing={editing} onEdit={onEdit} onReview={onReview} />
          <span className="audit-muted" style={{ fontSize: '0.75rem' }}>
            Teclas: <span className="audit-kbd">A</span> correto · <span className="audit-kbd">E</span> corrigir ·{' '}
            <span className="audit-kbd">R</span> incorreto · <span className="audit-kbd">P</span> abrir no PDF
          </span>
        </div>
        <div>
          <div className="audit-eyebrow">O que ela citou</div>
          <AuditEvidenceList result={current} onOpen={onOpenEvidence} />
        </div>
      </section>
    </>
  );
};
