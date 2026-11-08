import React from 'react';
import type { Article, InvestigationResult, ResultReview } from '../../../types';
import { aiAnswerText, finalAnswerText } from '../../../utils/investigationAnswers';
import { AuditEvidenceList } from './AuditEvidence';
import type { AuditEvidenceItem } from '../../../utils/auditEvidence';
import { AuditVerdict } from './AuditVerdict';
import { REVIEW_CHIP } from './auditLabels';

export interface AuditEvidencePanelProps {
  result: InvestigationResult | null;
  questionNumber?: number;
  article?: Article;
  editing: boolean;
  onEdit: (open: boolean) => void;
  onReview: (review: ResultReview) => void;
  onOpenEvidence: (evidence: AuditEvidenceItem) => void;
  onOpenArticle?: () => void;
}

/**
 * The side panel of the audit table: the selected answer, what the AI cited, and the verdict buttons, so an answer is
 * checked and marked in one place.
 *
 * Usage:
 *   <AuditEvidencePanel result={selected} article={article} editing={editing} onEdit={...} onReview={...} onOpenEvidence={...} />
 */
export const AuditEvidencePanel: React.FC<AuditEvidencePanelProps> = (props) => {
  const { result, questionNumber, article, editing, onEdit, onReview, onOpenEvidence, onOpenArticle } = props;
  if (!result) {
    return (
      <aside className="audit-panel audit-side">
        <div className="audit-empty">
          Abra uma pergunta e escolha um item para conferir a resposta e a evidência aqui.
        </div>
      </aside>
    );
  }
  const chip = REVIEW_CHIP[result.review_status];
  return (
    <aside className="audit-panel audit-side" aria-label="Evidência do item selecionado">
      <div className="audit-side-head">
        <div className="audit-row audit-spread">
          <span className="audit-eyebrow">
            P{questionNumber} · {article?.title ?? `Artigo ${result.article_id}`}
          </span>
          <span className={`audit-chip ${chip.className}`}>{chip.label}</span>
        </div>
        <strong className="audit-question-strong">{result.question}</strong>
      </div>
      <div className="audit-side-body">
        <div>
          <div className="audit-eyebrow audit-mb-4">Resposta da IA</div>
          <div className="audit-answer">{aiAnswerText(result) || '—'}</div>
          {result.review_status === 'edited' && (
            <p className="audit-correction">
              <strong>Sua correção:</strong> {finalAnswerText(result)}
            </p>
          )}
        </div>
        <div className="audit-stack-8">
          <div className="audit-eyebrow">O que ela citou</div>
          <AuditEvidenceList result={result} onOpen={onOpenEvidence} onOpenArticle={onOpenArticle} />
        </div>
        <AuditVerdict result={result} editing={editing} onEdit={onEdit} onReview={onReview} />
      </div>
    </aside>
  );
};
