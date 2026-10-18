import React, { useState } from 'react';
import type { InvestigationAudit } from '../../../types';
import { newAuditSeed, type AuditParams } from '../../../utils/auditSampling';

interface AuditSetupProps {
  audit: InvestigationAudit | null;
  onDraw: (params: AuditParams) => void;
}

const DEFAULTS = { samplePercent: 10, minPerQuestion: 2 };

/**
 * The draw settings: share of each question's answers, minimum per question, and the stored seed. Drawing again picks
 * other items; the marks already made stay saved as reviews.
 *
 * Usage:
 *   <AuditSetup audit={audit} onDraw={draw} />
 */
export const AuditSetup: React.FC<AuditSetupProps> = ({ audit, onDraw }) => {
  const [samplePercent, setPercent] = useState(audit?.sample_percent ?? DEFAULTS.samplePercent);
  const [minPerQuestion, setMin] = useState(audit?.min_per_question ?? DEFAULTS.minPerQuestion);
  const valid = samplePercent > 0 && samplePercent <= 100 && Number.isInteger(minPerQuestion) && minPerQuestion >= 1;

  const draw = () => {
    const again = audit !== null;
    if (
      again &&
      !window.confirm(
        'Sortear de novo troca os itens da amostra. As marcações já feitas continuam salvas como revisão, mas só entram na taxa se forem sorteadas de novo. Continuar?',
      )
    )
      return;
    onDraw({ seed: newAuditSeed(), samplePercent, minPerQuestion });
  };

  return (
    <div className="audit-settings">
      <label className="audit-field">
        Amostra (%)
        <input
          type="number"
          min={1}
          max={100}
          value={samplePercent}
          onChange={(e) => setPercent(Number(e.target.value))}
        />
      </label>
      <label className="audit-field">
        Mínimo por pergunta
        <input type="number" min={1} value={minPerQuestion} onChange={(e) => setMin(Number(e.target.value))} />
      </label>
      {audit && (
        <span className="audit-field">
          Semente
          <span className="audit-num" style={{ fontSize: '0.85rem', color: 'var(--text-main)', padding: '5px 0' }}>
            {audit.seed}
          </span>
        </span>
      )}
      <button type="button" className={audit ? 'btn-secondary' : 'btn-primary'} disabled={!valid} onClick={draw}>
        {audit ? 'Sortear de novo' : 'Sortear amostra'}
      </button>
    </div>
  );
};
