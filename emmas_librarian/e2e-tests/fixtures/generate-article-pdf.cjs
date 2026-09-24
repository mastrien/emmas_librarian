// Generates e2e-tests/fixtures/artigo-teste-emma.pdf: a 4-page synthetic scientific article with a real text layer
// (standard Helvetica fonts, WinAnsi encoding, so Portuguese accents are searchable in pdf.js).
// No dependencies: the PDF objects and cross-reference table are written by hand.
//
// Usage (from emmas_librarian/):  node e2e-tests/fixtures/generate-article-pdf.cjs
const fs = require('fs');
const path = require('path');
const { METADATA, BLOCKS } = require('./articleContent.cjs');

const PAGE = { width: 595, height: 842, margin: 64, top: 770, bottom: 72 };
const TEXT_WIDTH = PAGE.width - 2 * PAGE.margin;
const FONTS = { regular: 'F1', bold: 'F2', italic: 'F3' };

// Helvetica advance widths (1/1000 em) for ASCII 32..126, from the standard AFM.
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];

function charWidth(ch) {
  // Accented letters are as wide as their base letter.
  const base = ch.normalize('NFD')[0];
  const code = base.charCodeAt(0);
  return code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32] : 556;
}

const textWidth = (text, size, font) =>
  ([...text].reduce((sum, ch) => sum + charWidth(ch), 0) * size * (font === FONTS.bold ? 1.06 : 1)) / 1000;

function wrap(text, size, font, width = TEXT_WIDTH) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, font) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// PDF string literal in WinAnsi (Latin-1 for these characters), escaping the delimiters.
const pdfString = (text) =>
  '(' +
  Buffer.from(text, 'latin1')
    .toString('latin1')
    .replace(/[\\()]/g, (c) => `\\${c}`) +
  ')';

/** Lays blocks out into pages of positioned text runs. */
class Layout {
  constructor() {
    this.pages = [];
    this.newPage();
  }

  newPage() {
    this.page = [];
    this.pages.push(this.page);
    this.y = PAGE.top;
  }

  ensure(height) {
    if (this.y - height < PAGE.bottom) this.newPage();
  }

  text(x, text, size, font) {
    this.page.push({ x, y: this.y, text, size, font });
  }

  paragraph(text, { size = 10.5, font = FONTS.regular, indent = 0, gapAfter = 8, leading = 1.45 } = {}) {
    for (const line of wrap(text, size, font, TEXT_WIDTH - indent)) {
      this.ensure(size * leading);
      this.text(PAGE.margin + indent, line, size, font);
      this.y -= size * leading;
    }
    this.y -= gapAfter;
  }

  centered(text, size, font) {
    for (const line of wrap(text, size, font)) {
      this.text((PAGE.width - textWidth(line, size, font)) / 2, line, size, font);
      this.y -= size * 1.35;
    }
  }

  table(caption, rows) {
    const colWidth = TEXT_WIDTH / rows[0].length;
    this.ensure(14 * (rows.length + 2));
    this.text(PAGE.margin, caption, 9.5, FONTS.bold);
    this.y -= 16;
    rows.forEach((row, i) => {
      row.forEach((cell, c) => this.text(PAGE.margin + c * colWidth, cell, 9.5, i === 0 ? FONTS.bold : FONTS.regular));
      this.y -= 14;
    });
    this.y -= 10;
  }
}

function layoutArticle() {
  const layout = new Layout();
  layout.centered(METADATA.title, 15, FONTS.bold);
  layout.y -= 6;
  layout.centered(METADATA.authors, 10.5, FONTS.regular);
  layout.centered(
    'Programa de Pós-Graduação em Ciência da Informação, Universidade Fictícia do Brasil',
    9,
    FONTS.italic,
  );
  layout.centered(`DOI: ${METADATA.doi}`, 9, FONTS.regular);
  layout.y -= 14;
  const render = {
    abstractTitle: (b) => layout.paragraph(b.text, { size: 11, font: FONTS.bold, gapAfter: 2 }),
    abstract: (b) => layout.paragraph(b.text, { size: 10, indent: 12, gapAfter: 4 }),
    keywords: (b) => layout.paragraph(b.text, { size: 10, font: FONTS.italic, indent: 12, gapAfter: 14 }),
    h: (b) => {
      layout.ensure(40);
      layout.paragraph(b.text, { size: 12, font: FONTS.bold, gapAfter: 2 });
    },
    p: (b) => layout.paragraph(b.text),
    ref: (b) => layout.paragraph(b.text, { size: 9.5, gapAfter: 4 }),
    table: (b) => layout.table(b.caption, b.rows),
    pageBreak: () => layout.newPage(),
  };
  for (const block of BLOCKS) render[block.type](block);
  return layout.pages;
}

function pageStream(runs, pageNumber, pageCount) {
  const header = `${METADATA.journal}, v. ${METADATA.volume}, n. ${METADATA.issue}, p. ${METADATA.pages}, ${METADATA.year}`;
  const decorations = [
    { x: PAGE.margin, y: PAGE.height - 40, text: header, size: 8, font: FONTS.italic },
    {
      x: PAGE.margin,
      y: 40,
      text: 'Documento sintético para testes - conteúdo fictício (CC0)',
      size: 7.5,
      font: FONTS.italic,
    },
    { x: PAGE.width - PAGE.margin - 40, y: 40, text: `${pageNumber} / ${pageCount}`, size: 8, font: FONTS.regular },
  ];
  return [...decorations, ...runs]
    .map((r) => `BT /${r.font} ${r.size} Tf ${r.x.toFixed(2)} ${r.y.toFixed(2)} Td ${pdfString(r.text)} Tj ET`)
    .join('\n');
}

function buildPdf(pages) {
  const objects = [];
  const add = (body) => objects.push(body) && objects.length;
  const catalog = add(null);
  const pagesRoot = add(null);
  const fonts = {
    F1: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    F2: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
    F3: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'),
  };
  const fontDict = Object.entries(fonts)
    .map(([name, id]) => `/${name} ${id} 0 R`)
    .join(' ');
  const pageIds = pages.map((runs, i) => {
    const stream = Buffer.from(pageStream(runs, i + 1, pages.length), 'latin1');
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`);
    return add(
      `<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
        `/Resources << /Font << ${fontDict} >> >> /Contents ${content} 0 R >>`,
    );
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
  objects[pagesRoot - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const info = add(
    `<< /Title ${pdfString(METADATA.title)} /Author ${pdfString(METADATA.authors)} ` +
      `/Subject ${pdfString(`${METADATA.journal} - DOI ${METADATA.doi}`)} /Producer (emmas_librarian e2e fixture) >>`,
  );
  return serialize(objects, catalog, info);
}

function serialize(objects, rootId, infoId) {
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = objects.map((body, i) => {
    const offset = Buffer.byteLength(out, 'latin1');
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const target = path.join(__dirname, 'artigo-teste-emma.pdf');
fs.writeFileSync(target, buildPdf(layoutArticle()));
console.log(`wrote ${path.relative(process.cwd(), target)}`);
