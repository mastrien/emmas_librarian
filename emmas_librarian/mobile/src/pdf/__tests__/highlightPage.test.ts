import { describe, it, expect } from 'vitest';
import { highlightPage } from '../highlightPage';

describe('highlightPage', () => {
  it.each([
    ['{"boundingRect":{"pageNumber":4}}', 4],
    ['{"pageNumber":2}', 2],
    [{ boundingRect: { pageNumber: 7 } }, 7],
    [{ pageNumber: 3, boundingRect: {} }, 3],
  ])('reads the page of %j', (position, page) => {
    expect(highlightPage(position)).toBe(page);
  });

  it.each(['not json', '{}', null, undefined, '{"pageNumber":0}', '{"pageNumber":"x"}', { pageNumber: 1.5 }])(
    'answers null for %j',
    (position) => {
      expect(highlightPage(position)).toBeNull();
    },
  );
});
