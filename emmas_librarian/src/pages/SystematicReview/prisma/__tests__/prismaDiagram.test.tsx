import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { boxLines, fit, prismaLayout, WIDTH } from '../prismaLayout';
import { PrismaDiagram, PRINT_PALETTE, SCREEN_PALETTE } from '../PrismaDiagram';
import { diagramSvgText, exportPrismaDiagram } from '../prismaExport';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import { smallFlow } from './prismaTestData';

describe('prismaLayout (#50)', () => {
  const flow = smallFlow();
  const layout = prismaLayout(flow);
  const place = (key: string) => layout.boxes.find((b) => b.key === key)!;

  it('keeps every arrow straight and its tip 1px short of the box it points to', () => {
    const down = layout.arrows.filter((a) => a.x1 === a.x2);
    const across = layout.arrows.filter((a) => a.y1 === a.y2);

    expect(down).toHaveLength(4);
    expect(across).toHaveLength(4);
    expect(down[0]).toMatchObject({ y1: place('identified').y + place('identified').h, y2: place('screened').y - 1 });
    expect(across.every((a) => a.x2 === place('removed').x - 1)).toBe(true);
  });

  it('centres each exclusion box on the step that sends articles to it', () => {
    const screened = place('screened');
    const excluded = place('excluded');

    expect(excluded.y + excluded.h / 2).toBeCloseTo(screened.y + screened.h / 2, 0);
  });

  it('grows a box with its lines and fits the whole diagram in 800 px', () => {
    expect(place('identified').h).toBeGreaterThan(place('included').h);
    expect(Math.max(...layout.boxes.map((b) => b.x + b.w))).toBeLessThanOrEqual(WIDTH);
    expect(layout.bands.map((b) => b.label)).toEqual(['Identificação', 'Triagem', 'Incluídos']);
  });

  it('writes one short line per kind of warning and cuts lines that do not fit', () => {
    expect(boxLines(flow.screened, 44).map((l) => l.text)).toContain('⚠ não fecha (veja ao lado)');
    expect(boxLines(flow.identified, 44).map((l) => l.text)).toContain('⚠ busca pode ser parcial');
    expect(fit('Desenho de estudo não elegível (n = 5)', 20)).toBe('Desenho de estudo n…');
  });
});

describe('PrismaDiagram (#50)', () => {
  it('makes every box a button that selects it', () => {
    const onSelect = vi.fn();
    render(
      <PrismaDiagram
        layout={prismaLayout(smallFlow())}
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

  it('renders the exported figure as a plain, light SVG with its size and numbers', () => {
    const svg = diagramSvgText(smallFlow());

    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[^>]*width="800"/);
    expect(svg).toContain('Registros identificados (n = 9)');
    expect(svg).toContain(PRINT_PALETTE.surface);
    expect(svg).not.toContain('role="button"');
  });
});

describe('exportPrismaDiagram (#50)', () => {
  it('sends the SVG text and the data table to be saved', async () => {
    const service = new FakeProjectService();

    const saved = await exportPrismaDiagram(service, 3, 'svg', smallFlow());

    const [projectId, format, image, csv] = service.exportPrismaDiagram.mock.calls[0];
    expect([projectId, format, saved]).toEqual([3, 'svg', '/out/prisma.svg']);
    expect(image.startsWith('<svg')).toBe(true);
    expect(csv.split('\n')[0]).toBe('"Caixa","Linha","n","De onde vem","Aviso"');
  });

  it('draws a PNG from the SVG at the diagram size before sending it', async () => {
    const service = new FakeProjectService();
    const rasterize = vi.fn(async () => 'UE5H');

    await exportPrismaDiagram(service, 3, 'png', smallFlow(), rasterize);

    expect(rasterize).toHaveBeenCalledWith(expect.stringMatching(/^<svg/), 800, prismaLayout(smallFlow()).height);
    expect(service.exportPrismaDiagram.mock.calls[0].slice(1, 3)).toEqual(['png', 'UE5H']);
  });
});
