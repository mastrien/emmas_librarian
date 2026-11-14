import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ProjectReader } from '../../../reader/ProjectReader';
import { SessionProvider } from '../../../session/SessionContext';
import { ArticleScreen } from '../../ArticleScreen';
import { PdfScreen } from '../../PdfScreen';
import { ProjectScreen } from '../../ProjectScreen';
import { ProjectsScreen } from '../../ProjectsScreen';
import type { PdfOpener } from '../../../pdf/pdfDocument';

const Whereabouts: React.FC = () => {
  const location = useLocation();
  return <output data-testid="address">{location.pathname + location.search}</output>;
};

interface LibraryOptions {
  leave?: () => void;
  openPdf?: PdfOpener;
}

/**
 * Draws the library screens at an address, reading from `reader`; the address on screen is in the
 * element with test id "address", so a test can see where a tap led.
 *
 * @example renderLibrary(reader, '/projects/1/diary');
 */
export function renderLibrary(reader: ProjectReader, at: string, options: LibraryOptions = {}) {
  return render(
    <SessionProvider reader={reader} leave={options.leave ?? (() => undefined)}>
      <MemoryRouter initialEntries={[at]}>
        <Whereabouts />
        <Routes>
          <Route path="/projects" element={<ProjectsScreen />} />
          <Route path="/projects/:projectId/:tab?" element={<ProjectScreen />} />
          <Route path="/articles/:articleId" element={<ArticleScreen />} />
          <Route path="/articles/:articleId/pdf" element={<PdfScreen open={options.openPdf} />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}
