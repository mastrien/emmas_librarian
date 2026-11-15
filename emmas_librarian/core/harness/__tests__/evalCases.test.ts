// @vitest-environment node
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { commandSchemas } from '../commandSchemas';
import { LibraryToolkit } from '../LibraryToolkit';
import { CHECK_NAMES, runCheck, snapshot } from '../eval/evalChecks';
import { parseEvalCases, type EvalCase } from '../eval/evalCase';
import { FakeConfirmer } from './support/FakeConfirmer';
import { seedLibraryF } from './support/libraryF';
import { openTestLibrary } from './support/openTestLibrary';

const text = fs.readFileSync(path.join(__dirname, '../eval/cases.jsonl'), 'utf-8');
const cases = parseEvalCases(text);

const offeredIn = (testCase: EvalCase, library = openTestLibrary()) => {
  const toolkit = new LibraryToolkit({
    commands: library.commands,
    schemas: commandSchemas(),
    modelIsLocal: testCase.context.modelIsLocal ?? true,
    confirmer: new FakeConfirmer(testCase.context.confirm !== 'no'),
  });
  return { toolkit, library };
};

describe('the evaluation set', () => {
  it('has a case of every kind, with unique ids', () => {
    expect(new Set(cases.map((c) => c.kind))).toEqual(new Set(['happy', 'trap', 'refusal', 'error']));
    expect(cases.length).toBeGreaterThan(60);
  });

  it('refuses a malformed line, naming the line and the value', () => {
    expect(() => parseEvalCases('{"id":"a","kind":"odd","prompt":"x"}')).toThrow(/Line 1: unknown kind.*"odd"/);
    expect(() => parseEvalCases('não é json')).toThrow(/ERR_INVALID_EVAL_CASE/);
    const one = '{"id":"a","kind":"happy","prompt":"x","expect":{"calls":[]},"checks":[]}';
    expect(() => parseEvalCases(`${one}\n${one}`)).toThrow(/duplicate id.*"a"/);
  });

  it('uses only checks that exist', () => {
    const used = cases.flatMap((c) => c.checks.map((check) => check.check));
    expect(used.filter((name) => !CHECK_NAMES.includes(name))).toEqual([]);
  });

  // The policy and the cases are decided together: a case that expects a tool the policy hides, or forbids one it offers,
  // is wrong on one side.
  it.each(cases.map((c) => [c.id, c] as const))('%s agrees with what the toolkit offers', (_id, testCase) => {
    const { toolkit, library } = offeredIn(testCase);
    const offered = new Set(toolkit.tools().map((tool) => tool.name));
    library.close();
    expect(testCase.expect.calls.filter((call) => !offered.has(call.tool)).map((call) => call.tool)).toEqual([]);
    expect(testCase.expect.forbidden.filter((tool) => offered.has(tool))).toEqual([]);
  });
});

describe('the ideal trajectories, run offline on Biblioteca de teste F', () => {
  const runnable = cases.filter((c) => c.solvable !== false);

  it.each(runnable.map((c) => [c.id, c] as const))('%s ends where its checks say', async (_id, testCase) => {
    const { toolkit, library } = offeredIn(testCase);
    try {
      await seedLibraryF(library.commands);
      const before = await snapshot(library.commands);
      const codes: string[] = [];
      for (const call of testCase.expect.calls) {
        const answer = await toolkit.call(call.tool, call.input);
        if (!answer.ok) codes.push(answer.error.code);
      }
      expect(codes).toEqual(testCase.expect.errors);
      for (const check of testCase.checks)
        expect(await runCheck(check, library.commands, before), check.check).toBe(true);
    } finally {
      library.close();
    }
  });
});
