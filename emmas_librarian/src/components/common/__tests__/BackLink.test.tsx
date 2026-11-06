import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BackLink } from '../BackLink';

const Where: React.FC = () => {
  const location = useLocation();
  return <p>{`em ${location.pathname} ${JSON.stringify(location.state)}`}</p>;
};

const renderAt = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/inicio']}>
      <Routes>
        <Route path="/inicio" element={ui} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe('BackLink (Arca 134)', () => {
  it('names where it goes and goes there', () => {
    renderAt(<BackLink to="/projects/3">Voltar ao projeto</BackLink>);

    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao projeto' }));

    expect(screen.getByText('em /projects/3 null')).toBeInTheDocument();
  });

  it('carries route state, as the reader does back to an audit', () => {
    renderAt(<BackLink to="/projects/3/investigation/9" state={{ openAudit: 9 }} label="Voltar à auditoria" />);

    fireEvent.click(screen.getByRole('link', { name: 'Voltar à auditoria' }));

    expect(screen.getByText('em /projects/3/investigation/9 {"openAudit":9}')).toBeInTheDocument();
  });

  it('gives an arrow-only link its label as name and tooltip', () => {
    renderAt(<BackLink to="/" label="Voltar aos projetos" />);

    const link = screen.getByRole('link', { name: 'Voltar aos projetos' });
    expect(link).toHaveAttribute('title', 'Voltar aos projetos');
    expect(link).toHaveClass('back-link', 'back-link--icon');
    expect(link).toHaveTextContent('');
  });

  it('is a button when the way back is not a route', () => {
    const back = vi.fn();
    renderAt(<BackLink onClick={back}>Voltar</BackLink>);

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('keeps its own look and adds only the page spacing class', () => {
    renderAt(
      <BackLink to="/" className="page-back">
        Voltar aos projetos
      </BackLink>,
    );

    expect(screen.getByRole('link').className).toBe('back-link page-back');
  });
});
