import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CommandPalette } from '../CommandPalette';
import { ServicesProvider } from '../../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../../services/__tests__/fakes/FakeProjectService';
import type { Article } from '../../../../../types';

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;

function renderPalette(projectId?: number) {
  const service = FakeProjectService.create();
  service.getProjects.mockResolvedValue([
    { id: 3, name: 'Previsão Climática', created_at: '' },
    { id: 4, name: 'Soft sensors', created_at: '' },
  ]);
  service.getArticles.mockResolvedValue([
    { id: 10, title: 'Deep learning for rainfall', authors: 'Lima, A.', year: 2024 } as Article,
  ]);
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={['/inicio']}>
      <ServicesProvider apiService={service}>
        <CommandPalette currentProjectId={projectId} onClose={onClose} />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </ServicesProvider>
    </MemoryRouter>,
  );
  return { service, onClose, input: screen.getByRole('combobox', { name: 'Ir para, buscar artigo, executar' }) };
}

const options = () => within(screen.getByRole('listbox')).getAllByRole('option');

describe('CommandPalette', () => {
  it('starts with the places of the current project and the modules, the first one chosen', async () => {
    renderPalette(3);

    expect(await screen.findByRole('option', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Deep learning/ })).not.toBeInTheDocument();
  });

  it('finds an article of the project by author and opens it in the reader with Enter', async () => {
    const { input, onClose } = renderPalette(3);

    fireEvent.change(input, { target: { value: 'lima rainfall' } });
    await screen.findByRole('option', { name: /Deep learning for rainfall/ });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location')).toHaveTextContent('/articles/10');
    expect(onClose).toHaveBeenCalled();
  });

  it('moves the choice with the arrows, wrapping around', async () => {
    const { input } = renderPalette();
    await screen.findByRole('option', { name: 'Início' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options()[1].id);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(options().at(-1)).toHaveAttribute('aria-selected', 'true');
  });

  it('goes to a project picked with the mouse', async () => {
    const { input } = renderPalette();

    fireEvent.change(input, { target: { value: 'previsao' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Previsão Climática' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/projects/3');
  });

  it('says when nothing matches', async () => {
    const { input, service } = renderPalette();
    await screen.findByRole('option', { name: 'Início' });

    fireEvent.change(input, { target: { value: 'zzzz' } });

    expect(screen.getByText('Nada encontrado para “zzzz”.')).toBeInTheDocument();
    expect(service.getArticles).not.toHaveBeenCalled();
  });
});
