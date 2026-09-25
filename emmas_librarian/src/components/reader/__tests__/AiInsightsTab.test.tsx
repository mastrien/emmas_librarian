import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiInsightsTab } from '../AiInsightsTab';

describe('AiInsightsTab', () => {
  it('shows the empty state and triggers generation on click', () => {
    const onGenerateSummary = vi.fn();
    render(<AiInsightsTab isGeneratingAi={false} aiSummary={null} onGenerateSummary={onGenerateSummary} />);

    expect(screen.getByText(/Nenhum resumo gerado ainda/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Resumo com IA' }));

    expect(onGenerateSummary).toHaveBeenCalledTimes(1);
  });

  it('disables the button and shows progress while generating', () => {
    render(<AiInsightsTab isGeneratingAi={true} aiSummary={null} onGenerateSummary={vi.fn()} />);

    const button = screen.getByRole('button', { name: /Gerando Resumo/ });
    expect(button).toBeDisabled();
  });

  it('renders both summaries as markdown', () => {
    const aiSummary = { generalSummary: 'Texto **importante**', sectionSummary: '- Método\n- Resultados' };
    render(<AiInsightsTab isGeneratingAi={false} aiSummary={aiSummary} onGenerateSummary={vi.fn()} />);

    expect(screen.queryByText(/Nenhum resumo gerado ainda/)).not.toBeInTheDocument();
    expect(screen.getByText('Visão Geral')).toBeInTheDocument();
    expect(screen.getByText('importante').tagName).toBe('STRONG');
    expect(screen.getByText('Por Seções')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Método', 'Resultados']);
  });
});
