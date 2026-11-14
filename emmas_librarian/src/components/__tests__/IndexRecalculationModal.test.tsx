import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexRecalculationModal } from '../modals/IndexRecalculationModal';
import type { AskIndexPlan } from '../../types';

const PLAN: AskIndexPlan = {
  pending: 17,
  outdated: 0,
  sizeChanged: false,
  othersLosingVectors: 0,
  previousModel: null,
};

function renderModal(extra: Partial<React.ComponentProps<typeof IndexRecalculationModal>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <IndexRecalculationModal
      plan={PLAN}
      running={false}
      confirmLabel="Refazer e rodar"
      onConfirm={onConfirm}
      onClose={onClose}
      {...extra}
    />,
  );
  return { onConfirm, onClose };
}

describe('IndexRecalculationModal (board 179)', () => {
  it('asks in the board words, keeping its accessible name', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Recalcular os PDFs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Refazer o índice antes de rodar?' })).toBeInTheDocument();
  });

  it('offers Cancelar beside the confirm button', () => {
    const { onConfirm, onClose } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refazer e rodar' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('locks both buttons while it recalculates', () => {
    renderModal({ running: true });

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Recalculando/ })).toBeDisabled();
  });
});
