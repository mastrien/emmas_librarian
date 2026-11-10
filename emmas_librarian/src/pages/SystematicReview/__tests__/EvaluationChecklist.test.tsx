import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EvaluationChecklist, readySteps } from '../EvaluationChecklist';

const renderChecklist = (props: Partial<React.ComponentProps<typeof EvaluationChecklist>> = {}) =>
  render(
    <MemoryRouter>
      <EvaluationChecklist
        projectId={3}
        hasCriteria={false}
        decided={0}
        engine={null}
        onWriteCriteria={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );

describe('readySteps', () => {
  it('counts the criteria, the decided articles and the engine', () => {
    expect(readySteps({ hasCriteria: false, decided: 0, engine: null })).toBe(0);
    expect(readySteps({ hasCriteria: true, decided: 0, engine: 'ollama' })).toBe(2);
    expect(readySteps({ hasCriteria: true, decided: 5, engine: 'ollama' })).toBe(3);
  });
});

describe('EvaluationChecklist (board 167)', () => {
  it('says what is missing and offers the criteria as the primary action', () => {
    const onWriteCriteria = vi.fn();
    renderChecklist({ onWriteCriteria });

    expect(screen.getByText('0 de 3 pronto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Escrever os critérios do projeto' }));

    expect(onWriteCriteria).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Abrir triagem' })).toHaveAttribute('href', '/projects/3/review');
  });

  it('marks what is ready, and lets the criteria be edited', () => {
    renderChecklist({ hasCriteria: true, decided: 12, engine: 'ollama/llama3.1' });

    expect(screen.getByText('3 de 3 pronto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar critérios' })).toBeInTheDocument();
    expect(screen.getByText(/12 decididos/)).toBeInTheDocument();
    expect(screen.getByText(/ollama\/llama3.1 ·/)).toBeInTheDocument();
  });
});
