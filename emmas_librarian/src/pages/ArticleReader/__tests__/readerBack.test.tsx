import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ArticleReaderToolbar } from '../components/ArticleReaderToolbar';
import type { Article } from '../../../types';

const article = { id: 1, project_id: 3, title: 'Estudo 1', status: 'read' } as Article;

const Probe: React.FC = () => <div data-testid="where">{useLocation().pathname}</div>;

function renderToolbar(state: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/articles/1', state }]}>
      <Routes>
        <Route
          path="/articles/1"
          element={
            <ArticleReaderToolbar
              article={article}
              hasLocalFile
              uploading={false}
              scale={1}
              handleZoom={vi.fn()}
              handleFileUpload={vi.fn()}
              handleUnlinkClick={vi.fn()}
              setIsEditingMetadata={vi.fn()}
              setIsCitationModalOpen={vi.fn()}
            />
          }
        />
        <Route path="/projects/*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Validation of epic #44: back from a PDF opened in the guided screening led to the project page.
describe('back from the reader to the page it was opened from', () => {
  it('returns to the guided screening when opened from it', () => {
    renderToolbar({ backTo: { path: '/projects/3/review/guided', label: 'Voltar à triagem guiada' } });

    fireEvent.click(screen.getByRole('link', { name: 'Voltar à triagem guiada' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/projects/3/review/guided');
  });

  it('still returns to the project when nothing says otherwise', () => {
    renderToolbar(null);

    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao projeto' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/projects/3');
  });
});
