import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { AskIndexPlan } from '../../types';
import { embeddingModelName, pdfCount } from '../../utils/pdfCount';

/**
 * Asks before recalculating with the current embedding model: it costs tokens and, with a model of another size, also
 * removes the vectors of the rest of the library, since the table holds one size only. What was answered keeps its own
 * copy of what it cites, so it is not at risk.
 *
 * @example <IndexRecalculationModal plan={plan} running={false} confirmLabel="Recalcular" onConfirm={go} onClose={close} />
 */
export const IndexRecalculationModal: React.FC<{
  plan: AskIndexPlan;
  running: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ plan, running, confirmLabel, onConfirm, onClose }) =>
  createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
    >
      <div
        className="card fade-in"
        role="dialog"
        aria-label="Recalcular os PDFs"
        style={{ width: '440px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <h3 style={{ margin: 0 }}>Recalcular os PDFs</h3>
          <button
            type="button"
            aria-label="Fechar sem recalcular"
            disabled={running}
            onClick={onClose}
            style={{ background: 'none', border: 0, padding: 2, color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p>
          {pdfCount(plan.pending)} {plan.pending === 1 ? 'precisa' : 'precisam'} ser{' '}
          {plan.pending === 1 ? 'calculado' : 'calculados'} com o modelo de embeddings atual antes de entrar na busca.
          Isso consome tokens. Conversas e investigações já feitas não mudam.
        </p>
        {plan.othersLosingVectors > 0 && (
          <p role="note">
            O modelo atual usa vetores de outro tamanho, então os vetores{' '}
            {plan.othersLosingVectors === 1 ? 'do outro PDF' : `dos outros ${plan.othersLosingVectors} PDFs`} da
            biblioteca também serão apagados e precisarão ser recalculados quando você usá-los.
          </p>
        )}
        {plan.previousModel && (
          <p className="muted" data-testid="previous-model">
            Prefere não recalcular? Os vetores atuais vieram de {embeddingModelName(plan.previousModel)}. Volte a esse
            modelo em Configurações de IA, e só os PDFs ainda sem índice serão processados.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-primary" disabled={running} onClick={onConfirm}>
            {running ? `Recalculando ${pdfCount(plan.pending)}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
