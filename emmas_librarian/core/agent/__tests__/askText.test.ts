// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AskResult } from '../ask';
import { askAsText } from '../askText';

const base: AskResult = {
  answer: 'Você tem 1 projeto.',
  calls: [],
  stopped: 'answered',
  fallback: 'none',
  subjects: [],
  device: '',
};

describe('askAsText', () => {
  it('is just the answer when no call was made', () => {
    expect(askAsText(base)).toBe('Você tem 1 projeto.');
  });

  it('lists every call below the answer, saying which did not go through and why', () => {
    const text = askAsText({
      ...base,
      calls: [
        { tool: 'projects__getAll', arguments: '{}', ok: true },
        { tool: 'projects__delete', arguments: '{"id":1}', ok: false, error: 'ERR_NOT_CONFIRMED' },
      ],
    });
    expect(text).toBe(
      'Você tem 1 projeto.\n\nChamadas feitas:\n- projects__getAll({}) ok\n- projects__delete({"id":1}) recusada ou com erro: ERR_NOT_CONFIRMED',
    );
  });

  it('cuts a long argument', () => {
    const text = askAsText({ ...base, calls: [{ tool: 't', arguments: 'x'.repeat(300), ok: true }] });
    expect(text).toContain(`${'x'.repeat(120)}…)`);
  });

  it('says so when there is no answer, or the steps ran out', () => {
    expect(askAsText({ ...base, answer: '  ' })).toContain('(sem resposta)');
    expect(askAsText({ ...base, answer: '', stopped: 'max-steps' })).toContain('limite de passos');
  });
});
