import { describe, expect, it, vi } from 'vitest';

// setupTests replaces this module for every other suite (jsdom has no canvas); this one tests the real thing.
vi.unmock('../webglSupport');

import { hasWebGl } from '../webglSupport';

/** A canvas whose contexts are decided by the test: names → what getContext returns for them. */
class FakeCanvas {
  constructor(private readonly contexts: Record<string, object | null | Error>) {}
  getContext(name: string): object | null {
    const found = this.contexts[name] ?? null;
    if (found instanceof Error) throw found;
    return found;
  }
}
const canvasWith = (contexts: Record<string, object | null | Error>) => () =>
  new FakeCanvas(contexts) as unknown as HTMLCanvasElement;

describe('hasWebGl', () => {
  it('is true when the browser gives a webgl2 context', () => {
    expect(hasWebGl(canvasWith({ webgl2: {} }))).toBe(true);
  });

  it('falls back to webgl 1 when webgl2 is not there', () => {
    expect(hasWebGl(canvasWith({ webgl2: null, webgl: {} }))).toBe(true);
  });

  it('is false when no context can be created (VMs, CI runners, old GPUs)', () => {
    expect(hasWebGl(canvasWith({}))).toBe(false);
  });

  it('is false when the driver throws instead of answering', () => {
    expect(hasWebGl(canvasWith({ webgl2: new Error('BindToCurrentSequence failed') }))).toBe(false);
  });
});
