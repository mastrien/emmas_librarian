import { describe, it, expect } from 'vitest';
import type { CommandFn } from '../CommandRegistry';
import { CommandRegistry } from '../CommandRegistry';
import { parameterNames } from '../parameterNames';
import { terminalUsage } from '../terminalCommands';

describe('parameterNames', () => {
  it.each<[string, CommandFn, string[]]>([
    ['no parameters', () => 1, []],
    ['plain parameters', (projectId: number, date: string) => [projectId, date], ['projectId', 'date']],
    ['an async function', async (articleId: number) => articleId, ['articleId']],
    ['a default value', (target: object, replaceIndex = false) => [target, replaceIndex], ['target', 'replaceIndex']],
    [
      'a default with commas and brackets',
      (limits = { a: 1, b: [2, 3] }, sort = 'date') => [limits, sort],
      ['limits', 'sort'],
    ],
    [
      'an object taken apart',
      ({ id, venueData }: { id: number; venueData: object }) => [id, venueData],
      ['{ id, venueData }'],
    ],
    ['the rest of the arguments', (...args: unknown[]) => args, ['...args']],
    ['a lone parameter without parentheses', eval('x => x') as CommandFn, ['x']],
    [
      'a signature written over several lines',
      (projectId: number, title: string, url?: string | null) => [projectId, title, url],
      ['projectId', 'title', 'url'],
    ],
  ])('reads %s', (_label, fn, names) => {
    expect(parameterNames(fn)).toEqual(names);
  });

  it('reads a function declared with the function keyword', () => {
    function saveEntry(projectId: number, content: string) {
      return [projectId, content];
    }

    expect(parameterNames(saveEntry)).toEqual(['projectId', 'content']);
  });
});

describe('command parameters in the registry', () => {
  it('takes the names from the function, or the ones given when it only forwards', () => {
    const commands = new CommandRegistry();
    commands.add('diary:getOne', (projectId: number, date: string) => [projectId, date]);
    commands.add('proxy', (...args: unknown[]) => args, { parameters: ['projectId', 'filePath'] });

    expect(commands.get('diary:getOne').parameters).toEqual(['projectId', 'date']);
    expect(commands.get('proxy').parameters).toEqual(['projectId', 'filePath']);
  });

  it('writes the usage line of a command', () => {
    const commands = new CommandRegistry();
    commands.add('diary:getOne', (projectId: number, date: string) => [projectId, date]);
    commands.add('trash:empty', () => undefined);

    expect(terminalUsage(commands.get('diary:getOne'))).toBe('emmas-librarian cli diary:getOne -- <projectId> <date>');
    expect(terminalUsage(commands.get('trash:empty'))).toBe('emmas-librarian cli trash:empty');
  });
});
