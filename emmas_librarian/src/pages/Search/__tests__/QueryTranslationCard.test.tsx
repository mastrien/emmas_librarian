import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryTranslationCard } from '../QueryTranslationCard';

describe('QueryTranslationCard', () => {
  // Regression: a CSS capitalize turned the official "arXiv" into "ArXiv" on the card.
  it('shows the base name as written, without changing its case', () => {
    render(
      <QueryTranslationCard
        databaseName="arXiv"
        translation={{ query: 'ti:rainfall', isValid: true }}
        onCustomQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByText('arXiv')).not.toHaveStyle({ textTransform: 'capitalize' });
    expect(screen.getByText('ti:rainfall')).toBeInTheDocument();
  });
});
