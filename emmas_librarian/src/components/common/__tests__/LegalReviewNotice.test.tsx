import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LegalReviewNotice } from '../LegalReviewNotice';
import { IEEE_AI_WARNING } from '../../../pages/Terms/termsContent';

describe('LegalReviewNotice', () => {
  it('warns, as an alert, that no lawyer reviewed the terms', () => {
    render(<LegalReviewNotice />);

    expect(screen.getByRole('alert')).toHaveTextContent(/NÃO foram revistos por um advogado/);
  });

  it('adds the specific line when given', () => {
    render(<LegalReviewNotice detail={IEEE_AI_WARNING} compact />);

    expect(screen.getByRole('alert')).toHaveTextContent(/proíbem usar o conteúdo para treinar/);
  });
});
