import { describe, it, expect } from 'vitest';
import { isTextEntry } from '../isTextEntry';

const input = (type: string) => {
  const el = document.createElement('input');
  el.type = type;
  return el;
};

describe('isTextEntry', () => {
  it('is true for the fields one types text in', () => {
    expect(isTextEntry(input('text'))).toBe(true);
    expect(isTextEntry(input('search'))).toBe(true);
    expect(isTextEntry(input('password'))).toBe(true);
    expect(isTextEntry(document.createElement('textarea'))).toBe(true);
    expect(isTextEntry(document.createElement('select'))).toBe(true);
  });

  it('is true for editable content', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'isContentEditable', { value: true });

    expect(isTextEntry(el)).toBe(true);
  });

  // The regression: the styled switch keeps focus on its hidden checkbox after a click, and 1/2/3 stopped deciding.
  it('is false for a checkbox, a radio and a button, which take no typed text', () => {
    expect(isTextEntry(input('checkbox'))).toBe(false);
    expect(isTextEntry(input('radio'))).toBe(false);
    expect(isTextEntry(input('button'))).toBe(false);
  });

  it('is false for anything that is not an element', () => {
    expect(isTextEntry(null)).toBe(false);
    expect(isTextEntry(document.body)).toBe(false);
    expect(isTextEntry(window)).toBe(false);
  });
});
