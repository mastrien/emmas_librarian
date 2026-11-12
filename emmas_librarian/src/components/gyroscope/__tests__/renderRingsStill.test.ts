import { describe, it, expect, vi } from 'vitest';

// The setup replaces the module (a canvas cannot draw in jsdom); this test wants the real one.
const real = () => vi.importActual<typeof import('../GyroscopeCanvas')>('../GyroscopeCanvas');

describe('renderRingsStill', () => {
  it('gives nothing where there is no WebGL, so the caller can draw something flat instead', async () => {
    const { renderRingsStill } = await real();

    expect(renderRingsStill({ ring: '#4f46e5', inner: '#f8fafc' }, 84)).toBeNull();
  });

  it('remembers the answer for the same colours and size', async () => {
    const { renderRingsStill } = await real();

    expect(renderRingsStill({ ring: '#111111', inner: '#eeeeee' }, 84)).toBe(
      renderRingsStill({ ring: '#111111', inner: '#eeeeee' }, 84),
    );
  });
});
