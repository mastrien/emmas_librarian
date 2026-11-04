import { describe, expect, it } from 'vitest';
import type { AskReadCitation } from '../../../types';
import { readerBackFrom } from '../../../utils/readerReturn';
import {
  auditNotice,
  citationAccessNote,
  citationLabel,
  citationReaderState,
  stepText,
  unverifiedReason,
} from '../askDisplay';

const citation = (extra: Partial<AskReadCitation> = {}): AskReadCitation => ({
  articleId: 1,
  title: 'Título',
  authors: 'Almeida, R.; Tavares, C.',
  year: 2021,
  page: 4,
  bbox: { x: 0, y: 0, w: 1, h: 1 },
  text: 'trecho',
  pdfPath: 'a.pdf',
  access: { kind: 'open', articleId: 1 },
  ...extra,
});

describe('citationLabel', () => {
  it('uses the first surname, the year and the page', () => {
    expect(citationLabel(citation())).toBe('Almeida 2021, p. 4');
  });

  it('reads authors written without a comma', () => {
    expect(citationLabel(citation({ authors: 'Almeida R' }))).toBe('Almeida 2021, p. 4');
  });

  it('goes without the year', () => {
    expect(citationLabel(citation({ year: null }))).toBe('Almeida, p. 4');
  });

  it('falls back on a shortened title without authors', () => {
    expect(citationLabel(citation({ authors: null, title: 'T'.repeat(60) }))).toBe(`${'T'.repeat(27)}…, p. 4`);
    expect(citationLabel(citation({ authors: '', title: 'Curto' }))).toBe('Curto, p. 4');
  });
});

describe('unverifiedReason', () => {
  it('names what was cited and how much was read', () => {
    const reason = unverifiedReason({ kind: 'unknown_source', sources: ['27'], available: 20 });

    expect(reason).toBe('A IA citou 27, mas só 20 trechos foram lidos. Confira antes de usar.');
  });

  it('says when nothing was cited', () => {
    expect(unverifiedReason({ kind: 'no_source' })).toContain('não indicou de onde');
  });

  it('says when the answer came outside the format', () => {
    expect(unverifiedReason({ kind: 'loose_text' })).toContain('fora do formato');
  });
});

describe('citationAccessNote', () => {
  it('has nothing to say about the article itself', () => {
    expect(citationAccessNote(citation())).toBeNull();
  });

  it('says when it opens through a copy', () => {
    expect(citationAccessNote(citation({ access: { kind: 'open', articleId: 2 } }))).toContain(
      'cópia em outro projeto',
    );
  });

  it('tells the trash from the end of the PDF', () => {
    expect(citationAccessNote(citation({ access: { kind: 'trash' } }))).toContain('lixeira');
    expect(citationAccessNote(citation({ access: { kind: 'gone' } }))).toContain('não estão mais na biblioteca');
  });

  it('never calls a citation in the trash removed', () => {
    expect(citationAccessNote(citation({ access: { kind: 'trash' } }))).not.toContain('removid');
  });
});

describe('stepText', () => {
  it('says what was read, in the plural', () => {
    expect(stepText({ kind: 'search', chunks: 20, articles: 12, projects: ['A', 'B'] })).toBe(
      'Buscou nos PDFs de 2 projetos: 20 trechos de 12 artigos',
    );
  });

  it('and in the singular', () => {
    expect(stepText({ kind: 'search', chunks: 1, articles: 1, projects: ['A'] })).toBe(
      'Buscou nos PDFs de 1 projeto: 1 trecho de 1 artigo',
    );
  });
});

describe('auditNotice', () => {
  it('agrees with the count', () => {
    expect(auditNotice(1)).toBe('1 ponto desta resposta não pôde ser conferido.');
    expect(auditNotice(2)).toBe('2 pontos desta resposta não puderam ser conferidos.');
  });
});

describe('citationReaderState', () => {
  it('opens on the page and quote, and the reader accepts the way back', () => {
    const state = citationReaderState(citation(), 3);

    expect(state).toMatchObject({ searchQuery: 'trecho', page: 4 });
    expect(readerBackFrom(state)).toEqual({ path: '/ask/3', label: 'Voltar à conversa' });
  });
});
