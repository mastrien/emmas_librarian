import { describe, it, expect } from 'vitest';
import type { CommandSchema } from '../commandSchema';
import { restorePositions, withoutParameters } from '../hiddenParameters';

const text = { type: 'string' as const };
const create: CommandSchema = {
  name: 'projectDocuments:create',
  source: 'test',
  parameters: [
    { name: 'projectId', required: true, schema: { type: 'number' } },
    { name: 'title', required: true, schema: text },
    { name: 'url', required: false, schema: text },
    { name: 'sourceFilePath', required: false, schema: text },
    { name: 'category', required: false, schema: text },
  ],
};

describe('hidden parameters', () => {
  it('takes the argument out of what the model sees', () => {
    expect(withoutParameters(create, ['sourceFilePath']).parameters.map((p) => p.name)).toEqual([
      'projectId',
      'title',
      'url',
      'category',
    ]);
  });

  it('leaves the hidden slot empty when the arguments after it are given', () => {
    expect(restorePositions(create, ['sourceFilePath'], [3, 'Guia', 'https://x.org', 'tema'])).toEqual([
      3,
      'Guia',
      'https://x.org',
      undefined,
      'tema',
    ]);
  });

  it('drops the empty slots at the end, as a shell would', () => {
    expect(restorePositions(create, ['sourceFilePath'], [3, 'Guia'])).toEqual([3, 'Guia']);
  });
});
