// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decidedConfig, decisionFile } from '../eval/decision/decidedSetup';
import { DEFAULT_SETUP } from '../eval/run/runSetup';

describe('decidedConfig', () => {
  it('starts from the first decision model, two subjects and no fallback on confidence', () => {
    expect(decidedConfig({})).toMatchObject({ topAreas: 2, minConfidence: 0, port: 8090 });
  });

  it('takes --top-areas and --min-confidence from the command line', () => {
    expect(decidedConfig({ 'top-areas': '3', 'min-confidence': '0.6' })).toMatchObject({
      topAreas: 3,
      minConfidence: 0.6,
    });
  });

  it('names the model it does not know and the ones it does', () => {
    expect(() => decidedConfig({ 'decision-model': 'inexistente' })).toThrow(/ERR_UNKNOWN_MODEL.*inexistente.*d1-2b/);
  });

  it.each(['0', '1.5'])('refuses --top-areas=%s, which is not a whole number of 1 or more', (value) => {
    expect(() => decidedConfig({ 'top-areas': value })).toThrow(/ERR_BAD_FLAG.*--top-areas/);
  });

  it.each(['-1', 'abc'])('refuses --min-confidence=%s, which is not a number of 0 or more', (value) => {
    expect(() => decidedConfig({ 'min-confidence': value })).toThrow(/ERR_BAD_FLAG.*--min-confidence/);
  });
});

describe('decisionFile', () => {
  it('is the model file inside the models folder of the setup', () => {
    const file = decisionFile(decidedConfig({}), DEFAULT_SETUP).replaceAll(String.fromCharCode(92), '/');
    expect(file).toBe('F:/llm-lab/models/d1-2B-Q4_K_M.gguf');
  });
});
