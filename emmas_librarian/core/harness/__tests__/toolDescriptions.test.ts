// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { commandSchemas } from '../commandSchemas';
import { LibraryToolkit } from '../LibraryToolkit';
import { FakeConfirmer } from './support/FakeConfirmer';

describe('what a model is told about the tools', () => {
  // Regression of case bus-2: LFM3 and Qwen never called search__translateQuery, whose only text was its argument schema.
  it('says that search__translateQuery converts a search to the format of each base, without running it', () => {
    const commands = new CommandRegistry();
    commands.add('search:translateQuery', (_ast: unknown) => ({}));
    const toolkit = new LibraryToolkit({ commands, schemas: commandSchemas(), confirmer: new FakeConfirmer(true) });
    const tool = toolkit.tools().find((offered) => offered.name === 'search__translateQuery');

    expect(tool?.description).toContain('Converte uma busca estruturada para o formato de cada base');
    expect(tool?.description).toContain('Scopus');
    expect(tool?.description).toContain('só traduz, não busca');
    expect(tool?.description).toContain("'title' | 'abstract'");
  });
});
