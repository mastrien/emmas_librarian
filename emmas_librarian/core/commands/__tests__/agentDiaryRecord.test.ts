import { describe, it, expect } from 'vitest';
import { appendAgentRecord } from '../agentDiaryRecord';

const when = new Date(2026, 10, 15, 9, 5);

describe('appendAgentRecord', () => {
  it('adds a stamped record after the text, keeping the text as it was', () => {
    expect(appendAgentRecord('Li dois artigos.\n', when, 'Terminei a triagem.')).toBe(
      'Li dois artigos.\n\n\n**2026-11-15 09:05 · registro do agente de IA**\nTerminei a triagem.',
    );
  });

  it('starts the page with the record when the page is empty', () => {
    expect(appendAgentRecord('', when, '- item')).toBe('**2026-11-15 09:05 · registro do agente de IA**\n- item');
  });

  it.each([[''], ['   '], [undefined as unknown as string]])('refuses the message %j, naming it', (message) => {
    expect(() => appendAgentRecord('x', when, message)).toThrow(/ERR_INVALID_ARGUMENTS.*Offending value/s);
  });
});
