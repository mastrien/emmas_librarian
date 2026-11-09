import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvestigationResult } from '../../../../types';
import { InvestigationResultBlock } from '../InvestigationResultBlock';

const result = (over: Partial<InvestigationResult>): InvestigationResult => ({
  id: 1,
  investigation_id: 2,
  article_id: 3,
  question: 'Qual o método?',
  answer: 'Radar',
  quote: null,
  status: 'success',
  error_message: null,
  created_at: '',
  review_status: 'pending',
  reviewed_answer: null,
  reviewed_at: null,
  ...over,
});

const renderBlock = (over: Partial<InvestigationResult>) =>
  render(<InvestigationResultBlock result={result(over)} onViewDocument={vi.fn()} onReview={vi.fn()} />);

describe('InvestigationResultBlock', () => {
  // Only an answer that came back can be reviewed (#47); an error or a skipped call has nothing to judge.
  it('offers the review for an answer that came back', () => {
    renderBlock({});
    expect(screen.getByRole('group', { name: 'Ações da revisão' })).toBeInTheDocument();
  });

  it.each([
    ['error', 'Erro: '],
    ['skipped', 'Pulado: '],
  ] as const)('shows a %s call with its reason and no review', (status, prefix) => {
    const { container } = renderBlock({ status, answer: null, error_message: 'cota' });

    expect(screen.getByText(`${prefix}cota`, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ações da revisão' })).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass(`answer-block--${status}`);
  });
});
