// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { MAX_TASKS, PLAN_TOOL, parsePlanCall, planFromReply, planInstructions, planTool } from '../eval/run/taskPlan';

const KNOWN = ['artigos', 'diario'];
const plan = (tarefas: unknown): string => JSON.stringify({ tarefas });

describe('parsePlanCall', () => {
  it('reads the tasks of a call', () => {
    const text = plan([
      { assunto: 'artigos', tarefa: 'ler o artigo 3' },
      { assunto: 'diario', tarefa: ' anotar ' },
    ]);
    expect(parsePlanCall(text, KNOWN)).toEqual([
      { area: 'artigos', task: 'ler o artigo 3' },
      { area: 'diario', task: 'anotar' },
    ]);
  });

  it('accepts an empty plan: nothing to do', () => {
    expect(parsePlanCall(plan([]), KNOWN)).toEqual([]);
  });

  it.each([
    ['arguments that are not JSON', '{"tarefas":'],
    ['arguments with no list', '{"outra":1}'],
    ['an unknown subject', plan([{ assunto: 'lixo', tarefa: 'x' }])],
    ['a task with no text', plan([{ assunto: 'artigos', tarefa: '  ' }])],
    ['an item that is not an object', plan(['ler'])],
  ])('fails on %s, saying what it got and what it wanted', (_why, text) => {
    expect(() => parsePlanCall(text, KNOWN)).toThrow(
      /\[ERR_INVALID_PLAN\] Offending value: .*Expected a submit_plan call/s,
    );
  });

  it('fails on a plan longer than the limit', () => {
    const many = plan(Array.from({ length: MAX_TASKS + 1 }, () => ({ assunto: 'artigos', tarefa: 'x' })));
    expect(() => parsePlanCall(many, KNOWN)).toThrow(`The plan has ${MAX_TASKS + 1} tasks`);
  });
});

describe('planFromReply', () => {
  const call = (name: string, args: string) => ({ content: '', toolCalls: [{ name, arguments: args }] });

  it('takes the plan from the submit_plan call', () => {
    const reply = call(PLAN_TOOL, plan([{ assunto: 'diario', tarefa: 'ver' }]));
    expect(planFromReply(reply, KNOWN)).toEqual([{ area: 'diario', task: 'ver' }]);
  });

  it('fails with the text the model wrote when it did not call the tool', () => {
    expect(() => planFromReply({ content: 'não tenho acesso', toolCalls: [] }, KNOWN)).toThrow(
      /Offending value: "não tenho acesso"\. No submit_plan call/,
    );
  });

  it('fails when it called another tool', () => {
    expect(() => planFromReply(call('projects__getAll', '{}'), KNOWN)).toThrow('No submit_plan call');
  });
});

describe('planTool and planInstructions', () => {
  it('offers one tool whose subject can only be one of the ids', () => {
    const tool = planTool(KNOWN);
    expect(tool.function.name).toBe(PLAN_TOOL);
    expect(JSON.stringify(tool.function.parameters)).toContain('"enum":["artigos","diario"]');
  });

  it('lists every subject with what it is for, and says to hand the plan in with the tool', () => {
    const text = planInstructions([{ id: 'artigos', about: 'ler artigos' }]);
    expect(text).toContain('- artigos: ler artigos');
    expect(text).toContain(PLAN_TOOL);
  });
});
