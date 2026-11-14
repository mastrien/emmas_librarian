import { describe, it, expect } from 'vitest';
import { assertReadableProjectFormat, projectFormatVersionOf, PROJECT_FORMAT_VERSION } from '../projectFileFormat';

describe('projectFormatVersionOf', () => {
  it('takes a file without the field as format 1', () => {
    expect(projectFormatVersionOf({})).toBe(1);
    expect(projectFormatVersionOf({ formatVersion: null })).toBe(1);
  });

  it('returns the declared version', () => {
    expect(projectFormatVersionOf({ formatVersion: 2 })).toBe(2);
  });

  it.each(['2', 0, 1.5, -1, {}])('rejects %j, naming the value and the expected shape', (declared) => {
    expect(() => projectFormatVersionOf({ formatVersion: declared })).toThrow(
      `formatVersion é ${JSON.stringify(declared)}, esperado um inteiro a partir de 1`,
    );
  });
});

describe('assertReadableProjectFormat', () => {
  it.each([{}, { formatVersion: 1 }, { formatVersion: PROJECT_FORMAT_VERSION }])('accepts %j', (projectJson) => {
    expect(() => assertReadableProjectFormat(projectJson)).not.toThrow();
  });

  it('refuses a format newer than the app reads and says to update', () => {
    expect(() => assertReadableProjectFormat({ formatVersion: PROJECT_FORMAT_VERSION + 1 })).toThrow(
      `formato ${PROJECT_FORMAT_VERSION + 1}, mas esta versão do app lê até o formato ${PROJECT_FORMAT_VERSION}`,
    );
  });
});
