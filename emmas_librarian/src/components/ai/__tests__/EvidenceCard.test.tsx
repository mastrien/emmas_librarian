import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EvidenceCard } from '../EvidenceCard';

const evidence = { text: 'trecho citado', page: 26, bbox: null, reasoning: 'fala da técnica', score: 0.53 };

describe('EvidenceCard', () => {
  it('shows the page, the score, the quote and opens the PDF on that evidence', () => {
    const open = vi.fn();
    render(<EvidenceCard evidence={evidence} onViewDocument={open} />);

    expect(screen.getByText('Página 26')).toBeInTheDocument();
    expect(screen.getByText('score 53')).toBeInTheDocument();
    expect(screen.getByText('trecho citado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir no PDF' }));

    expect(open).toHaveBeenCalledWith(evidence);
  });

  it('says the text cannot be searched when the evidence has none', () => {
    render(<EvidenceCard evidence={{ ...evidence, text: '' }} onViewDocument={vi.fn()} />);

    expect(screen.getByText('Texto indisponível para busca')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
