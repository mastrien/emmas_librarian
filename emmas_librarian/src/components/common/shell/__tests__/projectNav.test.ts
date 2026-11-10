import { describe, it, expect } from 'vitest';
import { PROJECT_NAV, isProjectSection, projectSegmentOf, isFocusRoute } from '../projectNav';

describe('isProjectSection', () => {
  it('accepts the sections the project page shows', () => {
    expect(['overview', 'articles', 'categories', 'diary', 'history'].every(isProjectSection)).toBe(true);
  });

  it('rejects screens of their own and a missing segment', () => {
    expect(isProjectSection('search')).toBe(false);
    expect(isProjectSection('review')).toBe(false);
    expect(isProjectSection(undefined)).toBe(false);
  });
});

describe('projectSegmentOf', () => {
  it('takes the first segment after the project id', () => {
    expect(projectSegmentOf('/projects/3/articles')).toBe('articles');
    expect(projectSegmentOf('/projects/3/review/prisma')).toBe('review');
    expect(projectSegmentOf('/projects/12/investigation/7')).toBe('investigation');
  });

  it('is undefined on the bare project path and outside projects', () => {
    expect(projectSegmentOf('/projects/3')).toBeUndefined();
    expect(projectSegmentOf('/agenda')).toBeUndefined();
  });
});

describe('PROJECT_NAV', () => {
  it('opens with the overview and links every project screen once', () => {
    const segments = PROJECT_NAV.flatMap((group) => group.items.map((item) => item.segment));

    expect(segments[0]).toBe('overview');
    expect(new Set(segments).size).toBe(segments.length);
    expect(segments).toEqual(expect.arrayContaining(['search', 'history', 'review', 'investigation']));
  });
});

describe('isFocusRoute', () => {
  it('is true for the guided screening only (board 165)', () => {
    expect(isFocusRoute('/projects/3/review/guided')).toBe(true);
    expect(isFocusRoute('/projects/3/review')).toBe(false);
    expect(isFocusRoute('/projects/3/review/prisma')).toBe(false);
  });
});
