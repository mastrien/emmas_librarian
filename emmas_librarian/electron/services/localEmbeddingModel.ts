export const LOCAL_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// The models the settings offer. The second is for text that is not in English, as most of the app's public writes (#55).
const LOCAL_MODELS: Record<string, string> = {
  'all-MiniLM-L6-v2': LOCAL_EMBEDDING_MODEL,
  'paraphrase-multilingual-MiniLM-L12-v2': 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
};

/**
 * Where a model named in the settings is downloaded from. A name it does not know gets the default, as every name did
 * before there was a choice, so a library set up back then keeps working.
 *
 * @example localModelRepository('all-MiniLM-L6-v2') // 'Xenova/all-MiniLM-L6-v2'
 */
export const localModelRepository = (modelName: string | undefined): string =>
  (modelName && LOCAL_MODELS[modelName]) || LOCAL_EMBEDDING_MODEL;

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
 * the model (~23 MB, or ~118 MB the multilingual one) again on every launch and never worked offline.
 * Without `modelsDir` (tests, dev scripts) the library default is kept.
 *
 * Usage:
 *   const extract = await loadLocalEmbeddingExtractor(path.join(userData, 'models'), await importTransformers(), name);
 */
export async function loadLocalEmbeddingExtractor(
  modelsDir: string | undefined,
  runtime: TransformersRuntime,
  modelName?: string,
): Promise<LocalEmbeddingExtractor> {
  if (modelsDir) runtime.env.cacheDir = modelsDir;
  return runtime.pipeline('feature-extraction', localModelRepository(modelName));
}
