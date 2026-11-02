import { act } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultReviewControls } from '../ResultReviewControls';
import type { InvestigationResult } from '../../../../types';

const result: InvestigationResult = {
  id: 7,
  investigation_id: 1,
  article_id: 2,
  question: 'Qual o desenho?',
  answer: JSON.stringify({ question: 'Q', synthesizedAnswer: 'Coorte', confidenceScore: 0.9, evidences: [] }),
  quote: null,
  status: 'success',
  error_message: null,
  created_at: '2026-10-18',
  review_status: 'pending',
  reviewed_answer: null,
  reviewed_at: null,
};

function setup(overrides: Partial<InvestigationResult> = {}) {
  const onReview = vi.fn().mockResolvedValue(undefined);
  render(<ResultReviewControls result={{ ...result, ...overrides }} onReview={onReview} />);
  return { onReview, block: screen.getByLabelText(/Revisão da resposta/) };
}

const press = async (target: Element, key: string) => {
  await act(async () => {
    fireEvent.keyDown(target, { key });
  });
};

describe('ResultReviewControls (#47)', () => {
  it('shows the review status of the answer', () => {
    setup({ review_status: 'rejected' });

    expect(screen.getByText('Revisão: rejeitada')).toBeInTheDocument();
  });

  it.each([
    ['Aceitar', { status: 'accepted' }],
    ['Rejeitar', { status: 'rejected' }],
  ])('sends "%s"', async (label, review) => {
    const { onReview } = setup();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: label }));
    });

    expect(onReview).toHaveBeenCalledWith(review);
  });

  it('edits starting from the AI answer, and saves the person’s text', async () => {
    const { onReview } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const box = screen.getByLabelText('Sua resposta');
    expect(box).toHaveValue('Coorte');
    fireEvent.change(box, { target: { value: 'Coorte prospectiva' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar resposta' }));
    });

    expect(onReview).toHaveBeenCalledWith({ status: 'edited', answer: 'Coorte prospectiva' });
    expect(screen.queryByLabelText('Sua resposta')).toBeNull();
  });

  // Validation of epic #44: saving the answer unchanged must not turn it into a correction.
  it('will not save an edit that changes nothing, by button or Ctrl+Enter', () => {
    // An answer whose edit was undone keeps the edited text to start from.
    const { onReview } = setup({ review_status: 'pending', reviewed_answer: 'Coorte prospectiva' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const box = screen.getByLabelText('Sua resposta');
    expect(box).toHaveValue('Coorte prospectiva');
    expect(screen.getByRole('button', { name: 'Salvar resposta' })).toBeDisabled();
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });

    expect(onReview).not.toHaveBeenCalled();
  });

  // Validation of epic #44: the three choices stayed on the card after one was chosen.
  it('gives way to "Desfazer" once an answer is marked, and the three come back after it', async () => {
    const { onReview, block } = setup({ review_status: 'accepted' });

    expect(screen.queryByRole('button', { name: 'Aceitar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rejeitar' })).toBeNull();
    await press(block, 'r');
    expect(onReview).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    });
    expect(onReview).toHaveBeenCalledWith({ status: 'pending' });

    cleanup();
    setup();
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });

  it('will not save an empty edit, and Esc leaves the edit without saving', () => {
    const { onReview } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Salvar resposta' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText('Sua resposta'), { key: 'Escape' });

    expect(screen.queryByLabelText('Sua resposta')).toBeNull();
    expect(onReview).not.toHaveBeenCalled();
  });

  it('answers the keys A, R and E on the focused answer, but not while typing', async () => {
    const { onReview, block } = setup();

    await press(block, 'a');
    await press(block, 'R');
    expect(onReview.mock.calls).toEqual([[{ status: 'accepted' }], [{ status: 'rejected' }]]);

    await press(block, 'e');
    await press(screen.getByLabelText('Sua resposta'), 'a');
    expect(onReview).toHaveBeenCalledTimes(2);
  });

  it('shows the person’s answer and can undo a decision', async () => {
    const { onReview } = setup({ review_status: 'edited', reviewed_answer: 'Coorte prospectiva' });

    expect(screen.getByText('Coorte prospectiva')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    });

    expect(onReview).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('offers no undo for an answer still pending', () => {
    setup();

    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });
});
