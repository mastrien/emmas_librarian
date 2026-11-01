import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { HelpButton } from '../HelpButton';

function openHelp(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <HelpButton />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Ajuda/ }));
}

// The review page explains every PRISMA term it uses (user request on the #50 prototype).
describe('HelpButton on the systematic review page (#50)', () => {
  it.each(['/projects/1/review', '/projects/1/review/prisma'])('explains the PRISMA terms on %s', (path) => {
    openHelp(path);

    expect(screen.getByText('Guia da Revisão Sistemática')).toBeInTheDocument();
    for (const term of [
      'Registro:',
      'Publicação:',
      'Estudo:',
      'Duplicado:',
      'Outros métodos:',
      'Aguardando decisões:',
    ]) {
      expect(screen.getByText(term)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'A declaração PRISMA 2020 (tradução oficial)' })).toHaveAttribute(
      'href',
      'https://doi.org/10.5123/S1679-49742022000200033',
    );
  });

  it('keeps the project guide on the project page', () => {
    openHelp('/projects/1');

    expect(screen.getByText('Guia do Projeto')).toBeInTheDocument();
  });
});
