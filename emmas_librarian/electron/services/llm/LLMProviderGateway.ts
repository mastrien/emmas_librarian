export interface LLMProviderGateway {
  /** Envia prompt e retorna texto gerado. */
  complete(prompt: string, model: string): Promise<string>;
}
