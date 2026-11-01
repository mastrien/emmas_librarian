/** A run of footer text; with `href` it is a link in the SVG, and written out in full so a PNG still shows it. */
export interface FooterSegment {
  text: string;
  href?: string;
}

export interface FooterLine {
  segments: FooterSegment[];
}

const PT_DOI = 'https://doi.org/10.5123/S1679-49742022000200033';
const EN_DOI = 'https://doi.org/10.1136/bmj.n71';

// ABNT NBR 6023 abbreviates months like this ("maio" is not abbreviated).
const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

/**
 * A date as ABNT writes "Acesso em".
 *
 * @example abntDate(new Date(2026, 10, 1)) // '1 nov. 2026'
 */
export function abntDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

const words = (text: string): FooterSegment[] => text.split(' ').map((w) => ({ text: w }));

/**
 * The reference of the PRISMA 2020 template under the diagram, in ABNT, with links to the official Brazilian
 * Portuguese translation the box titles come from and to the original paper (user request, #50).
 *
 * @example referenceTokens(new Date()).find((t) => t.href)?.href // 'https://doi.org/10.5123/S1679-49742022000200033'
 */
export function referenceTokens(today: Date): FooterSegment[] {
  return [
    ...words(
      'Modelo: PAGE, M. J. et al. A declaração PRISMA 2020: diretriz atualizada para relatar revisões sistemáticas. Tradução de Taís Freire Galvão e Gustavo Magno Baldin Tiguman. Epidemiologia e Serviços de Saúde, Brasília, v. 31, n. 2, e2022107, 2022. DOI: 10.5123/S1679-49742022000200033. Disponível em:',
    ),
    { text: `${PT_DOI}.`, href: PT_DOI },
    ...words(
      `Acesso em: ${abntDate(today)}. Original: PAGE, M. J. et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ, v. 372, n71, 2021. Disponível em:`,
    ),
    { text: `${EN_DOI}.`, href: EN_DOI },
  ];
}

/**
 * Breaks words into lines of at most `chars` characters, never inside a word, joining neighbouring plain words
 * into one segment.
 *
 * @example wrapTokens([{ text: 'a' }, { text: 'b' }], 80) // [{ segments: [{ text: 'a b' }] }]
 */
export function wrapTokens(tokens: FooterSegment[], chars: number): FooterLine[] {
  const lines: FooterSegment[][] = [[]];
  let length = 0;
  for (const token of tokens) {
    if (length > 0 && length + 1 + token.text.length > chars) {
      lines.push([]);
      length = 0;
    }
    lines[lines.length - 1].push(token);
    length += (length > 0 ? 1 : 0) + token.text.length;
  }
  return lines.map((line) => ({ segments: joinPlain(line) }));
}

function joinPlain(line: FooterSegment[]): FooterSegment[] {
  const out: FooterSegment[] = [];
  for (const token of line) {
    const last = out[out.length - 1];
    if (last && !last.href && !token.href) last.text += ` ${token.text}`;
    else out.push({ ...token });
  }
  return out;
}
