import { describe, it, expect } from 'vitest';
import { sortCitableArticles } from '../sortCitableArticles';
import { toCitableArticle } from '../../../../utils/cslMetadata';
import type { Article } from '../../../../types';

const citable = (id: number, authors: string, year?: number) =>
  toCitableArticle({ id, title: `T${id}`, authors, year, status: 'read' } as Article);

const ids = (list: { id: number }[]) => list.map((a) => a.id);

describe('sortCitableArticles', () => {
  it('orders by the first author surname with Portuguese collation', () => {
    const list = [citable(1, 'Maria Souza; Ana Alves'), citable(2, 'João Álvares'), citable(3, 'Rui Zé')];

    expect(ids(sortCitableArticles(list, 'author'))).toEqual([2, 1, 3]);
  });

  it('uses the literal name for institutional authors and puts missing authors first', () => {
    const list = [citable(1, 'Organização Mundial'), citable(2, ''), citable(3, 'Ana Brito')];

    expect(ids(sortCitableArticles(list, 'author'))).toEqual([2, 3, 1]);
  });

  it('orders by year with undated articles first', () => {
    const list = [citable(1, 'A', 2020), citable(2, 'B'), citable(3, 'C', 1999)];

    expect(ids(sortCitableArticles(list, 'year'))).toEqual([2, 3, 1]);
  });

  it('does not mutate the input', () => {
    const list = [citable(1, 'B', 2), citable(2, 'A', 1)];

    sortCitableArticles(list, 'year');

    expect(ids(list)).toEqual([1, 2]);
  });
});
