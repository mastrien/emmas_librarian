import type { LocalEmbeddingExtractor, TransformersRuntime } from '../../localEmbeddingModel';

/**
 * Fake @xenova/transformers: records where the model would be cached and which model was asked for,
 * and returns a fixed vector instead of downloading and running ONNX.
 *
 * Usage:
 *   const runtime = new FakeTransformersRuntime([0.1, 0.2]);
 *   await loadLocalEmbeddingExtractor('/userData/models', runtime);
 *   expect(runtime.cacheDirAtLoad).toBe('/userData/models');
 */
export class FakeTransformersRuntime implements TransformersRuntime {
  public env: { cacheDir: string | null } = { cacheDir: '/library/default/.cache' };
  public cacheDirAtLoad: string | null = null;
  public requestedModels: string[] = [];

  constructor(private readonly vector: number[]) {}

  public async pipeline(_task: 'feature-extraction', model: string): Promise<LocalEmbeddingExtractor> {
    this.cacheDirAtLoad = this.env.cacheDir;
    this.requestedModels.push(model);
    return async () => ({ data: Float32Array.from(this.vector) });
  }
}
