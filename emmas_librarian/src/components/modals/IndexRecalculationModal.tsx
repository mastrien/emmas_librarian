import React from 'react';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
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
}> = ({ plan, running, confirmLabel, onConfirm, onClose }) => (
  <Modal
    label="Recalcular os PDFs"
    title="Refazer o índice antes de rodar?"
    closeLabel="Fechar sem recalcular"
    busy={running}
    width={440}
    onClose={onClose}
  >
    <p>
      {pdfCount(plan.pending)} {plan.pending === 1 ? 'precisa' : 'precisam'} ser{' '}
      {plan.pending === 1 ? 'calculado' : 'calculados'} com o modelo de embeddings atual antes de entrar na busca. Isso
      consome tokens. Conversas e investigações já feitas não mudam.
    </p>
    {plan.othersLosingVectors > 0 && (
      <p role="note">
        O modelo atual usa vetores de outro tamanho, então os vetores{' '}
        {plan.othersLosingVectors === 1 ? 'do outro PDF' : `dos outros ${plan.othersLosingVectors} PDFs`} da biblioteca
        também serão apagados e precisarão ser recalculados quando você usá-los.
      </p>
    )}
    {plan.previousModel && (
      <p className="muted" data-testid="previous-model">
        Prefere não recalcular? Os vetores atuais vieram de {embeddingModelName(plan.previousModel)}. Volte a esse
        modelo em Configurações de IA, e só os PDFs ainda sem índice serão processados.
      </p>
    )}
    <ModalFooter hint={`${pdfCount(plan.pending)}`}>
      <Button variant="ghost" disabled={running} onClick={onClose}>
        Cancelar
      </Button>
      <Button variant="primary" disabled={running} onClick={onConfirm}>
        {running ? `Recalculando ${pdfCount(plan.pending)}…` : confirmLabel}
      </Button>
    </ModalFooter>
  </Modal>
);
