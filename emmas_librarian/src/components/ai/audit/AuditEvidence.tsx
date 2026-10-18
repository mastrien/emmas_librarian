import React from 'react';
import type { InvestigationResult } from '../../../types';
import { evidencesOf, type AuditEvidenceItem } from '../../../utils/auditEvidence';

interface AuditEvidenceListProps {
  result: InvestigationResult;
  onOpen: (evidence: AuditEvidenceItem) => void;
}

/**
 * What the AI cited, each quote with its page and "Abrir no PDF"; a warning when it cited nothing, since then the
 * answer can only be checked in the PDF.
 *
 * Usage:
 *   <AuditEvidenceList result={r} onOpen={(e) => openInReader(r, e)} />
 */
export const AuditEvidenceList: React.FC<AuditEvidenceListProps> = ({ result, onOpen }) => {
  const evidences = evidencesOf(result);
  if (evidences.length === 0) {
    return (
      <div className="audit-warn">
        A IA não citou nenhum trecho para esta resposta. Confira no PDF antes de marcar como correta.
      </div>
    );
  }
  return (
    <>
      {evidences.map((evidence, i) => (
        <div key={i} className="audit-evidence">
          <div className="audit-row audit-spread">
            <span className="audit-muted" style={{ fontSize: '0.72rem' }}>
              Evidência {i + 1}
              {evidence.page ? ` · página ${evidence.page}` : ''}
            </span>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '2px 8px' }}
              onClick={() => onOpen(evidence)}
            >
              Abrir no PDF ↗
            </button>
          </div>
          <div className="audit-quote">
            <mark>{evidence.text}</mark>
          </div>
        </div>
      ))}
    </>
  );
};
