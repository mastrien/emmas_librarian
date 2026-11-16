// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { MAX_TASKS, parsePlan, planInstructions } from '../eval/run/taskPlan';

const KNOWN = ['artigos', 'diario'];

describe('parsePlan', () => {
  it('reads the tasks of a clean list', () => {
    const text = '[{"assunto":"artigos","tarefa":"ler o artigo 3"},{"assunto":"diario","tarefa":" anotar "}]';
    expect(parsePlan(text, KNOWN)).toEqual([
      { area: 'artigos', task: 'ler o artigo 3' },
      { area: 'diario', task: 'anotar' },
    ]);
  });

  it('finds the list inside text and code fences the model wrote around it', () => {
    const text = 'Plano:\n```json\n[{"assunto":"artigos","tarefa":"listar"}]\n```';
    expect(parsePlan(text, KNOWN)).toEqual([{ area: 'artigos', task: 'listar' }]);
  });

  it('accepts an empty plan: nothing to do', () => {
    expect(parsePlan('[]', KNOWN)).toEqual([]);
  });

  it.each([
    ['no list at all', 'não consigo'],
    ['broken JSON', '[{"assunto":'],
    ['an unknown subject', '[{"assunto":"lixo","tarefa":"x"}]'],
    ['a task with no text', '[{"assunto":"artigos","tarefa":"  "}]'],
    ['an item that is not an object', '["ler"]'],
  ])('fails on %s, saying what it got and what it wanted', (_why, text) => {
    expect(() => parsePlan(text, KNOWN)).toThrow(/\[ERR_INVALID_PLAN\] Offending value: .*Expected a JSON list/s);
  });

  it('fails on a plan longer than the limit', () => {
    const many = JSON.stringify(Array.from({ length: MAX_TASKS + 1 }, () => ({ assunto: 'artigos', tarefa: 'x' })));
    expect(() => parsePlan(many, KNOWN)).toThrow(`The plan has ${MAX_TASKS + 1} tasks`);
  });
});

describe('planInstructions', () => {
  it('lists every subject with what it is for, and the format of the answer', () => {
    const text = planInstructions([{ id: 'artigos', about: 'ler artigos' }]);
    expect(text).toContain('- artigos: ler artigos');
    expect(text).toContain('"assunto"');
    expect(text).toContain('[]');
  });
});
