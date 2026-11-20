// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Prompter } from '../../cli/terminalConfirmer';
import { AGENT_MODELS } from '../runtime/agentModels';
import { consentOnTerminal, describeDownload } from '../runtime/downloadConsent';
import { listLlamaDevices } from '../runtime/listDevices';

class OneAnswer implements Prompter {
  readonly questions: string[] = [];
  constructor(private readonly answer: string | null) {}
  async ask(question: string): Promise<string | null> {
    this.questions.push(question);
    return this.answer;
  }
}

describe('the question before a download', () => {
  it('names the file, its size, the address and the license', () => {
    const text = describeDownload(AGENT_MODELS[0]);
    expect(text).toContain('LFM3-1.7B-Q4_K_M.gguf (1,02 GB)');
    expect(text).toContain('https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/');
    expect(text).toContain('LFM Open License v1.0 (https://www.liquid.ai/lfm-license)');
  });

  it.each([
    ['s', true],
    ['n', false],
    ['', false],
    [null, false],
  ])('answer %j is %s', async (answer, expected) => {
    const prompter = new OneAnswer(answer);
    expect(await consentOnTerminal(prompter)(AGENT_MODELS[1])).toBe(expected);
    expect(prompter.questions[0]).toContain('d1-2B-Q4_K_M.gguf');
  });
});

describe('listLlamaDevices', () => {
  it('gives what the server printed, asking it for --list-devices', async () => {
    const calls: Array<[string, string[]]> = [];
    const listing = await listLlamaDevices(
      '/bin/llama-server',
      async (file, args) => (calls.push([file, args]), 'CUDA0: x (1 MiB'),
    );
    expect(listing).toBe('CUDA0: x (1 MiB');
    expect(calls).toEqual([['/bin/llama-server', ['--list-devices']]]);
  });

  it('says the path it tried and where to give it when the server cannot be run', async () => {
    const failing = async (): Promise<string> => {
      throw new Error('spawn ENOENT');
    };
    await expect(listLlamaDevices('/nope/llama-server', failing)).rejects.toMatchObject({
      code: 'ERR_LLAMA_SERVER_NOT_FOUND',
      message: expect.stringContaining('"/nope/llama-server"'),
    });
  });
});
