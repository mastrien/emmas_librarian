import { describe, it, expect } from 'vitest';
import { activeModule } from '../modules';

describe('activeModule', () => {
  it('lights "Início" on the home screen and inside a project', () => {
    expect(activeModule('/')).toBe('home');
    expect(activeModule('/projects/4/review/prisma')).toBe('home');
    expect(activeModule('/new-project')).toBe('home');
  });

  it('lights "Início" in the reader, which is opened from a project', () => {
    expect(activeModule('/articles/9')).toBe('home');
  });

  it('lights the module of a module route and its sub-routes', () => {
    expect(activeModule('/ask/12')).toBe('ask');
    expect(activeModule('/pdfs')).toBe('pdfs');
    expect(activeModule('/agenda')).toBe('agenda');
    expect(activeModule('/settings')).toBe('settings');
  });

  it('lights nothing on the terms page', () => {
    expect(activeModule('/terms')).toBeUndefined();
  });

  it('does not take a route that only starts with the same letters', () => {
    expect(activeModule('/askew')).toBeUndefined();
  });
});
