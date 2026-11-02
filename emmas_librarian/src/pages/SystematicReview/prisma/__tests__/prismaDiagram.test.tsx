import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { boxLines, fit, PAD, prismaLayout, warningLines, withCount } from '../prismaLayout';
import { prismaOrder } from '../../../../utils/prismaFlow';
import { abntDate, referenceTokens, wrapTokens } from '../prismaReference';
import { PrismaDiagram, PRINT_PALETTE, SCREEN_PALETTE } from '../PrismaDiagram';
import { diagramSvgText, exportPrismaDiagram } from '../prismaExport';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import { smallFlow, twoColumnFlow } from './prismaTestData';
import { PRISMA_PT_URL } from '../../../../utils/prisma/prismaSourceLinks';

const TODAY = new Date(2026, 10, 1);
const TABLES = { data: 'dados', excluded: 'excluídas' };

describe('prismaLayout (#50): one column', () => {
  const flow = smallFlow();
  const layout = prismaLayout(flow, TODAY);
  const place = (key: string) => layout.boxes.find((b) => b.key === key)!;

  it('keeps every arrow straight, with its tip 1px short of the box it points to', () => {
    const down = layout.arrows.filter((a) => a.x1 === a.x2);
    const across = layout.arrows.filter((a) => a.y1 === a.y2);

    expect(down).toHaveLength(4);
    expect(across).toHaveLength(4);
    expect(down[0]).toMatchObject({ y1: place('identified').y + place('identified').h, y2: place('screened').y - 1 });
    expect(across.every((a) => a.x2 === place('removed').x - 1 && a.head)).toBe(true);
  });

  it('centres each exclusion box on the step that sends articles to it', () => {
    const screened = place('screened');
    const excluded = place('excluded');

    expect(excluded.y + excluded.h / 2).toBeCloseTo(screened.y + screened.h / 2, 0);
  });

  it('fits in 800 px under the databases heading, with the official phase names', () => {
    expect(layout.width).toBe(800);
    expect(Math.max(...layout.boxes.map((b) => b.x + b.w))).toBeLessThanOrEqual(800);
    expect(layout.heads.map((h) => h.label)).toEqual(['Identificação de estudos via bases de dados e repositórios']);
    expect(layout.bands.map((b) => b.label)).toEqual(['Identificação', 'Triagem', 'Incluído']);
    expect(layout.boxes.some((b) => b.key.startsWith('om'))).toBe(false);
  });

  // Regression (E2E of #50): long titles were cut with an ellipsis right where the number was.
  it('never cuts the number of a box or of a line', () => {
    for (const box of layout.boxes) {
      expect(box.lines.map((l) => l.text).join(' ')).toContain(`(n = ${flow[box.key].n})`);
      expect(box.label.startsWith(`${flow[box.key].title} (n = ${flow[box.key].n})`)).toBe(true);
    }
    expect(withCount('Desenho de estudo não elegível', 5, 24)).toBe('Desenho de estu… (n = 5)');
  });

  it('writes one short line per kind of warning and cuts lines that do not fit', () => {
    expect(boxLines(flow.screened, 44).map((l) => l.text)).toContain('⚠ aguardando decisões (veja ao lado)');
    expect(boxLines(flow.identified, 44).map((l) => l.text)).toContain('⚠ busca pode ser parcial');
    expect(fit('Desenho de estudo não elegível (n = 5)', 20)).toBe('Desenho de estudo n…');
  });
});

describe('prismaLayout (#50): two columns', () => {
  const layout = prismaLayout(twoColumnFlow(), TODAY);
  const place = (key: string) => layout.boxes.find((b) => b.key === key)!;

  it('adds the "other methods" column with its heading, inside 1000 px', () => {
    expect(layout.width).toBe(1000);
    expect(layout.heads.map((h) => h.label)).toEqual([
      'Identificação de estudos via bases de dados e repositórios',
      'Identificação de estudos por outros métodos',
    ]);
    expect(Math.max(...layout.boxes.map((b) => b.x + b.w))).toBeLessThanOrEqual(1000);
  });

  it('skips the screening row and reaches the included box from the side, the head only at the end', () => {
    // Found by the box's bottom AND centre: boxes of a row can share a height, and so a bottom.
    const leaving = (key: string) =>
      layout.arrows.find((a) => a.y1 === place(key).y + place(key).h && a.x1 === place(key).x + place(key).w / 2)!;
    const fromIdentified = leaving('omIdentified');
    const elbow = leaving('omAssessed');
    const toIncluded = layout.arrows.at(-1)!;

    expect(fromIdentified.y2).toBe(place('omSought').y - 1);
    expect(elbow.head).toBe(false);
    expect(toIncluded).toMatchObject({ x2: place('included').x + place('included').w + 1, head: true });
  });

  // Validation of epic #44: with every warning on, "⚠ aguardando decisões (veja ao lado)" ran up to 89 px past
  // the narrowest box (measured in Chrome). 6.6 px is the widest glyph average measured there at 13 px.
  it('keeps every line of every box inside it, warnings included', () => {
    const flow = twoColumnFlow();
    const kinds = ['mismatch', 'pending', 'partial', 'nodata'] as const;
    for (const key of prismaOrder(flow)) flow[key].warnings = kinds.map((kind) => ({ kind, text: kind }));
    const boxes = prismaLayout(flow, TODAY).boxes;
    const overflowing = boxes.flatMap((b) =>
      b.lines.filter((l) => l.text.length * 6.6 > b.w - 2 * PAD).map((l) => `${b.key}: ${l.text}`),
    );
    expect(overflowing).toEqual([]);
    expect(warningLines('pending', 21).map((l) => l.text)).toEqual(['⚠ aguardando decisões', '(veja ao lado)']);
  });
});

describe('PrismaDiagram (#50)', () => {
  it('makes every box a button that selects it', () => {
    const onSelect = vi.fn();
    render(
      <PrismaDiagram
        layout={prismaLayout(smallFlow(), TODAY)}
        palette={SCREEN_PALETTE}
        selected="screened"
        onSelect={onSelect}
      />,
    );

    const screened = screen.getByRole('button', { name: /^Registros triados \(n = 3\)/ });
    expect(screened).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Estudos incluídos na revisão \(n = 0\)/ }));
    fireEvent.keyDown(screened, { key: 'Enter' });

    expect(onSelect.mock.calls).toEqual([['included'], ['screened']]);
  });

  it('renders the exported figure as a plain, light SVG with its size, numbers and linked reference', () => {
    const svg = diagramSvgText(smallFlow(), TODAY);

    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[^>]*width="800"/);
    expect(svg).toContain('Registros identificados (n = 9)');
    expect(svg).toContain(PRINT_PALETTE.surface);
    expect(svg).not.toContain('role="button"');
    // The translation's DOI host refused connections (validation of epic #44): the link goes to the PRISMA site.
    expect(svg).toContain(`href="${PRISMA_PT_URL}"`);
    expect(svg).toContain('Acesso em: 1 nov. 2026.');
  });
});

describe('prismaReference (#50)', () => {
  it('writes the access date as ABNT does', () => {
    expect([abntDate(TODAY), abntDate(new Date(2026, 4, 9))]).toEqual(['1 nov. 2026', '9 maio 2026']);
  });

  it('wraps the reference without breaking a word or a link, keeping both links written out', () => {
    const lines = wrapTokens(referenceTokens(TODAY), 120);
    const texts = lines.map((l) => l.segments.map((s) => s.text).join(' '));

    expect(texts.every((t) => t.length <= 120)).toBe(true);
    expect(lines.flatMap((l) => l.segments.filter((s) => s.href).map((s) => s.text))).toEqual([
      `${PRISMA_PT_URL}.`,
      'https://doi.org/10.1136/bmj.n71.',
    ]);
    expect(texts.join(' ')).toContain('Tradução de Taís Freire Galvão e Gustavo Magno Baldin Tiguman.');
    expect(texts.join(' ')).toContain('DOI: 10.5123/S1679-49742022000200033.');
  });
});

describe('exportPrismaDiagram (#50)', () => {
  it('sends the SVG text and both tables to be saved', async () => {
    const service = new FakeProjectService();

    const saved = await exportPrismaDiagram(service, 3, {
      format: 'svg',
      flow: smallFlow(),
      tables: TABLES,
      today: TODAY,
    });

    const [projectId, format, image, tables] = service.exportPrismaDiagram.mock.calls[0];
    expect([projectId, format, saved, tables]).toEqual([3, 'svg', '/out/prisma.svg', TABLES]);
    expect(image.startsWith('<svg')).toBe(true);
  });

  it('draws a PNG from the SVG at the diagram size before sending it', async () => {
    const service = new FakeProjectService();
    const rasterize = vi.fn(async () => 'UE5H');
    const flow = twoColumnFlow();

    await exportPrismaDiagram(service, 3, { format: 'png', flow, tables: TABLES, today: TODAY }, rasterize);

    expect(rasterize).toHaveBeenCalledWith(expect.stringMatching(/^<svg/), 1000, prismaLayout(flow, TODAY).height);
    expect(service.exportPrismaDiagram.mock.calls[0].slice(1, 3)).toEqual(['png', 'UE5H']);
  });
});
