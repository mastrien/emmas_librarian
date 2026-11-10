import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvestigationStepper } from '../InvestigationStepper';

describe('InvestigationStepper', () => {
  it('marks the current step, checks the ones before it and numbers the ones after', () => {
    render(<InvestigationStepper current="model" counts={{ questions: 1, articles: 2 }} onGo={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Modelo e custo' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'Perguntas' }).closest('li')).toHaveClass('inv-step--done');
    expect(screen.getByRole('button', { name: /Executar/ })).toHaveTextContent('4Executar');
  });

  it('opens a reachable step and keeps the others shut', () => {
    const onGo = vi.fn();
    render(<InvestigationStepper current="questions" counts={{ questions: 1, articles: 0 }} onGo={onGo} />);

    fireEvent.click(screen.getByRole('button', { name: 'Artigos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modelo e custo' }));

    expect(onGo).toHaveBeenCalledTimes(1);
    expect(onGo).toHaveBeenCalledWith('articles');
    expect(screen.getByRole('button', { name: 'Modelo e custo' })).toBeDisabled();
  });
});
