import { describe, it, expect } from 'vitest';
import { rectsOnPage, scaledPosition } from '../highlightGeometry';
import { highlightPage } from '../highlightPage';
import { overlayFill } from '../highlightColors';

const page = { left: 10, top: 100, width: 400, height: 560 };

describe('scaledPosition', () => {
  it('turns screen rectangles into positions on the page, with the page size they were taken at', () => {
    const position = scaledPosition([{ left: 60, top: 220, width: 100, height: 14 }], page, 6);
    expect(position.rects).toEqual([{ x1: 50, y1: 120, x2: 150, y2: 134, width: 400, height: 560, pageNumber: 6 }]);
  });

  it('bounds several lines of a selection with one rectangle', () => {
    const position = scaledPosition(
      [
        { left: 60, top: 220, width: 300, height: 14 },
        { left: 30, top: 236, width: 120, height: 14 },
      ],
      page,
      2,
    );
    expect(position.boundingRect).toMatchObject({ x1: 20, y1: 120, x2: 350, y2: 150, pageNumber: 2 });
  });

  it('is read back by the code that finds the page of a highlight', () => {
    const position = scaledPosition([{ left: 60, top: 220, width: 100, height: 14 }], page, 9);
    expect(highlightPage(JSON.stringify(position))).toBe(9);
  });

  it('ignores empty rectangles, and refuses a selection with none left, saying so', () => {
    expect(
      scaledPosition(
        [
          { left: 0, top: 0, width: 0, height: 0 },
          { left: 60, top: 220, width: 10, height: 10 },
        ],
        page,
        1,
      ).rects,
    ).toHaveLength(1);
    expect(() => scaledPosition([{ left: 0, top: 0, width: 0, height: 5 }], page, 3)).toThrow(
      'at least one rectangle on page 3',
    );
  });
});

describe('rectsOnPage', () => {
  const position = scaledPosition([{ left: 60, top: 220, width: 100, height: 14 }], page, 6);

  it('scales a stored rectangle to the width the page is drawn at', () => {
    expect(rectsOnPage(position, 6, 200)).toEqual([{ left: 25, top: 60, width: 50, height: 7 }]);
  });

  it('draws only the rectangles of that page', () => {
    expect(rectsOnPage(position, 5, 400)).toEqual([]);
  });

  it('draws nothing for a position it does not understand', () => {
    expect(rectsOnPage(null, 1, 400)).toEqual([]);
    expect(rectsOnPage({ boundingRect: {} }, 1, 400)).toEqual([]);
  });
});

describe('overlayFill', () => {
  it('uses the stored colour name, and yellow for one it does not know', () => {
    expect(overlayFill('lightblue')).toContain('lightblue');
    expect(overlayFill('papaya')).toContain('yellow');
  });
});
