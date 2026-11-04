import type { BatchEmbedder } from '../ProjectIndexer';

/** Gives every text the vector the test chose, and keeps what it was asked. */
export class FakeEmbedder implements BatchEmbedder {
  calls: string[] = [];
  batches: string[][] = [];
  failOn: string | null = null;

  constructor(private readonly vector: number[] = [0, 0]) {}

  async embed(text: string): Promise<number[]> {
    this.calls.push(text);
    return this.vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    this.batches.push(texts);
    if (this.failOn && texts.includes(this.failOn)) throw new Error('provedor fora do ar');
    return texts.map(() => this.vector);
  }
}

/** The AI model: answers what the test chose and keeps the prompts. */
export class FakeAnswerModel {
  prompts: string[] = [];
  error: Error | null = null;

  constructor(public answer = '{"claims":[]}') {}

  readonly complete = async (prompt: string): Promise<string> => {
    this.prompts.push(prompt);
    if (this.error) throw this.error;
    return this.answer;
  };
}
