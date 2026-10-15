export const LOCAL_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

export type LocalEmbeddingExtractor = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

/** The slice of @xenova/transformers this app uses; tests pass a fake. */
export interface TransformersRuntime {
  env: { cacheDir: string | null };
  pipeline(task: 'feature-extraction', model: string): Promise<LocalEmbeddingExtractor>;
}

export const importTransformers = (): Promise<TransformersRuntime> =>
  import('@xenova/transformers') as unknown as Promise<TransformersRuntime>;

/**
 * Loads the local ONNX embedding model, caching the downloaded files in `modelsDir`.
 * The library's default cache sits next to its own code: inside app.asar on Windows and in the read-only
 * AppImage mount on Linux. Writing there fails with only a console warning, so a packaged app downloaded
 * the ~23 MB model again on every launch and never worked offline.
 * Without `modelsDir` (tests, dev scripts) the library default is kept.
 *
 * Usage:
 *   const extract = await loadLocalEmbeddingExtractor(path.join(userData, 'models'), await importTransformers());
 */
export async function loadLocalEmbeddingExtractor(
  modelsDir: string | undefined,
  runtime: TransformersRuntime,
): Promise<LocalEmbeddingExtractor> {
  if (modelsDir) runtime.env.cacheDir = modelsDir;
  return runtime.pipeline('feature-extraction', LOCAL_EMBEDDING_MODEL);
}
