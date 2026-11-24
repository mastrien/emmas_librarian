import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalLibrary } from '../../local/LocalLibrary';
import { LocalProjectReader } from '../../local/LocalProjectReader';
import { MemoryPdfStorage } from '../../local/__tests__/fakes/MemoryPdfStorage';
import type { PdfOpener, PdfPages } from '../../pdf/pdfDocument';
import type { PageSelection } from '../../pdf/selection';
import { SessionProvider } from '../../session/SessionContext';
import { PdfScreen } from '../PdfScreen';

class TextPdf implements PdfPages {
  pageCount = 2;
  pageRatio = 1.4;
  async renderPage(): Promise<void> {}
  async renderTextLayer(): Promise<void> {}
  close(): void {}
}

class PlainPdf implements PdfPages {
  pageCount = 1;
  pageRatio = 1.4;
  async renderPage(): Promise<void> {}
  close(): void {}
}

let library: LocalLibrary;
let reader: LocalProjectReader;
let selection: PageSelection | null;

beforeEach(async () => {
  let n = 0;
  library = LocalLibrary.empty('phone', { now: () => '2026-11-21T09:00:00.000Z', newUuid: () => `u${(n += 1)}` });
  const pdfs = new MemoryPdfStorage();
  reader = new LocalProjectReader(library, pdfs);
  const project = await reader.writer?.createProject?.('Ideas');
  await reader.writer?.addArticle?.(project as number, { title: 'Only here' });
  await pdfs.put(library.rows('articles')[0].uuid, new Uint8Array([1]));
  selection = null;
});

const open =
  (pdf: PdfPages): PdfOpener =>
  async () =>
    pdf;

function renderPdf(pdf: PdfPages) {
  return render(
    <SessionProvider reader={reader} leave={() => undefined}>
      <MemoryRouter initialEntries={['/articles/1/pdf']}>
        <Routes>
          <Route
            path="/articles/:articleId/pdf"
            element={<PdfScreen open={open(pdf)} readSelection={() => selection} />}
          />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

const select = (value: PageSelection | null) => {
  selection = value;
  document.dispatchEvent(new Event('selectionchange'));
};

const passage: PageSelection = {
  pageNumber: 2,
  text: 'Anxiety scores dropped by 0,42 SD',
  rects: [{ left: 40, top: 300, width: 200, height: 14 }],
  page: { left: 8, top: 100, width: 352, height: 490 },
};

// The default wait of Testing Library is 1 s, which the Windows runner of the CI missed once (#207): the selection reaches the
// screen after a few renders of the PDF page.
const SLOW_RUNNER = { timeout: 5000 };

describe('marking a passage', () => {
  it('offers the colours when text is selected, and hides the bar when the selection goes away', async () => {
    renderPdf(new TextPdf());
    await screen.findByLabelText('Página 2', {}, SLOW_RUNNER);
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

    select(passage);
    const bar = await screen.findByRole('toolbar', { name: 'Marcar trecho' }, SLOW_RUNNER);
    expect(bar).toHaveTextContent('Anxiety scores dropped');

    select(null);
    await waitFor(() => expect(screen.queryByRole('toolbar')).not.toBeInTheDocument(), SLOW_RUNNER);
  });

  it('marks the passage with the chosen colour and the note, as a position the desktop can read', async () => {
    renderPdf(new TextPdf());
    await screen.findByLabelText('Página 2');
    select(passage);
    fireEvent.change(await screen.findByLabelText('Nota (opcional)'), { target: { value: 'check the scale' } });

    fireEvent.click(screen.getByRole('button', { name: 'Marcar de azul' }));

    await waitFor(() => expect(library.rows('highlights')).toHaveLength(1));
    const [mark] = library.rows('highlights');
    expect(mark).toMatchObject({ color: 'lightblue', content_text: 'Anxiety scores dropped by 0,42 SD' });
    expect(JSON.parse(String(mark.position_data))).toMatchObject({ boundingRect: { pageNumber: 2, x1: 32, y1: 200 } });
    expect(library.rows('annotations')[0].content_markdown).toBe('check the scale');
  });

  it('draws the marks that already exist over their page', async () => {
    await reader.writer?.addHighlight?.(1, {
      color: 'yellow',
      positionData: {
        boundingRect: { pageNumber: 1 },
        rects: [{ x1: 10, y1: 20, x2: 110, y2: 34, width: 352, height: 490, pageNumber: 1 }],
      },
      contentText: 'old',
    });
    renderPdf(new TextPdf());
    expect(await screen.findAllByTestId('pdf-mark')).toHaveLength(1);
  });

  it('shows a new mark right after it is made', async () => {
    renderPdf(new TextPdf());
    await screen.findByLabelText('Página 2');
    select(passage);
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar de amarelo' }));
    expect(await screen.findAllByTestId('pdf-mark')).toHaveLength(1);
  });

  it('says so when the mark could not be saved, and keeps the bar', async () => {
    reader.writer!.addHighlight = async () => {
      throw new Error('disk full');
    };
    renderPdf(new TextPdf());
    await screen.findByLabelText('Página 2');
    select(passage);
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar de amarelo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível marcar');
  });

  it('offers nothing when the page has no selectable text (a scanned PDF)', async () => {
    renderPdf(new PlainPdf());
    await screen.findByLabelText('Página 1');
    select(passage);
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });
});
