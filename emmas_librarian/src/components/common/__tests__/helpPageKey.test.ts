import { describe, it, expect } from 'vitest';
import { helpPageKey } from '../HelpButton';

describe('helpPageKey', () => {
  it('opens the review help on every review screen', () => {
    expect(helpPageKey('/projects/3/review')).toBe('review');
    expect(helpPageKey('/projects/3/review/prisma')).toBe('review');
  });

  it('opens the search help on the new-search screen', () => {
    expect(helpPageKey('/projects/3/search')).toBe('search');
  });

  it('opens the project help on other project screens', () => {
    expect(helpPageKey('/projects/3')).toBe('project-details');
  });

  it('opens the reader help in the reader', () => {
    expect(helpPageKey('/articles/9')).toBe('reader');
  });

  it('uses the route itself for module screens', () => {
    expect(helpPageKey('/agenda')).toBe('/agenda');
  });
});
