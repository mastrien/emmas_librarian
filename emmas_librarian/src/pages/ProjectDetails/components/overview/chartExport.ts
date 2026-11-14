import type { Article } from '../../../../types';
import { articlesPerBase, articlesPerPublisher, yearHistogram, type RankedCount } from './overviewNumbers';

// "Exportar gráficos" (board 154): the overview's charts as one standalone SVG, with fixed light colours so it reads
// the same in a paper, a slide or a browser, whatever the app's theme was.

const WIDTH = 640;
const INK = '#334155';
const MUTED = '#64748b';
const ACCENT = '#4f46e5';
const PUBLISHERS_SHOWN = 10;

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const heading = (y: number, text: string): string =>
  `<text x="0" y="${y}" font-size="14" font-weight="600" fill="${INK}">${escapeXml(text)}</text>`;

/** Vertical bars, one per year, the first and last year under the baseline. Returns the SVG and its height. */
function yearChart(articles: Article[], top: number): { svg: string; height: number } {
  const { bars } = yearHistogram(articles);
  const chartHeight = 80;
  const highest = Math.max(1, ...bars.map((b) => b.count));
  const slot = WIDTH / Math.max(1, bars.length);
  const rects = bars.map((b, i) => {
    const h = (b.count / highest) * chartHeight;
    return `<rect x="${i * slot + 1}" y="${top + 24 + chartHeight - h}" width="${Math.max(1, slot - 2)}" height="${h}" fill="${ACCENT}"><title>${b.year}: ${b.count}</title></rect>`;
  });
  const first = bars[0]?.year ?? '';
  const last = bars[bars.length - 1]?.year ?? '';
  const axis = `<text x="0" y="${top + chartHeight + 40}" font-size="11" fill="${MUTED}">${first}</text><text x="${WIDTH}" y="${top + chartHeight + 40}" font-size="11" text-anchor="end" fill="${MUTED}">${last}</text>`;
  return { svg: heading(top + 12, 'Artigos por ano') + rects.join('') + axis, height: chartHeight + 56 };
}

/** Horizontal bars with the name on the left and the count on the right. */
function rankedChart(title: string, rows: RankedCount[], top: number): { svg: string; height: number } {
  const highest = Math.max(1, ...rows.map((r) => r.count));
  const labelWidth = 180;
  const barSpace = WIDTH - labelWidth - 40;
  const lines = rows.map((row, i) => {
    const y = top + 36 + i * 22;
    const width = Math.max(1, (row.count / highest) * barSpace);
    return (
      `<text x="0" y="${y}" font-size="12" fill="${INK}">${escapeXml(row.name.slice(0, 28))}</text>` +
      `<rect x="${labelWidth}" y="${y - 10}" width="${width}" height="10" rx="3" fill="${ACCENT}"/>` +
      `<text x="${WIDTH}" y="${y}" font-size="12" text-anchor="end" fill="${INK}">${row.count}</text>`
    );
  });
  return { svg: heading(top + 12, title) + lines.join(''), height: 36 + rows.length * 22 + 16 };
}

/**
 * The overview's charts (articles per year, per base and per publisher) as one SVG document.
 *
 * @example chartsSvg(articles).startsWith('<svg') // true
 */
export function chartsSvg(articles: Article[]): string {
  const parts: { svg: string; height: number }[] = [];
  let top = 16;
  const add = (part: { svg: string; height: number }) => {
    parts.push({ svg: `<g transform="translate(16 0)">${part.svg}</g>`, height: part.height });
    top += part.height + 16;
  };
  add(yearChart(articles, top));
  add(rankedChart('Bases de origem', articlesPerBase(articles), top));
  add(rankedChart('Editoras', articlesPerPublisher(articles).slice(0, PUBLISHERS_SHOWN), top));
  const body = parts.map((p) => p.svg).join('');
  const attrs = `xmlns="http://www.w3.org/2000/svg" width="${WIDTH + 32}" height="${top}" viewBox="0 0 ${WIDTH + 32} ${top}"`;
  return `<svg ${attrs} font-family="Inter, Segoe UI, sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>`;
}
