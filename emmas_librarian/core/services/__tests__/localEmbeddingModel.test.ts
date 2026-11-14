import { describe, it, expect } from 'vitest';
import { loadLocalEmbeddingExtractor, localModelRepository, LOCAL_EMBEDDING_MODEL } from '../localEmbeddingModel';
import { FakeTransformersRuntime } from './fakes/FakeTransformersRuntime';

describe('loadLocalEmbeddingExtractor', () => {
  it('caches the model in the given folder, set before the model is loaded', async () => {
    const runtime = new FakeTransformersRuntime([0.5]);
    await loadLocalEmbeddingExtractor('/userData/models', runtime);
    expect(runtime.cacheDirAtLoad).toBe('/userData/models');
    expect(runtime.requestedModels).toEqual([LOCAL_EMBEDDING_MODEL]);
  });

  it('loads the model named in the settings', async () => {
    const runtime = new FakeTransformersRuntime([0.5]);

    await loadLocalEmbeddingExtractor('/m', runtime, 'paraphrase-multilingual-MiniLM-L12-v2');

    expect(runtime.requestedModels).toEqual(['Xenova/paraphrase-multilingual-MiniLM-L12-v2']);
  });

  it.each([[undefined], [''], ['um-nome-qualquer']])('keeps the default for %s', (name) => {
    expect(localModelRepository(name)).toBe(LOCAL_EMBEDDING_MODEL);
  });

  it("keeps the library's own cache folder when none is given", async () => {
    const runtime = new FakeTransformersRuntime([0.5]);
    await loadLocalEmbeddingExtractor(undefined, runtime);
    expect(runtime.cacheDirAtLoad).toBe('/library/default/.cache');
  });

  it('returns an extractor that produces the vector', async () => {
    const extract = await loadLocalEmbeddingExtractor('/m', new FakeTransformersRuntime([0.25, 0.75]));
    const output = await extract('texto', { pooling: 'mean', normalize: true });
    expect(Array.from(output.data)).toEqual([0.25, 0.75]);
  });
});
