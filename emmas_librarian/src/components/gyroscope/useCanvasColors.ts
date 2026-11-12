import { useEffect, useState } from 'react';

/** The tokens of the app the rings take their colours from: the tone of the app's side bars for the ring, the page's for its inside. */
export const RING_TOKEN = '--bg-sunken';
export const INNER_TOKEN = '--bg-main';

export interface CanvasColors {
  ring: string | undefined;
  inner: string | undefined;
  theme: 'light' | 'dark';
}

/**
 * Reads a CSS colour token as the colour it is now. A canvas cannot read `var(--x)` itself, so a throwaway element takes
 * the token as its background and the browser resolves it, whatever the token is made of. An empty answer (no such
 * token, or no styles, as in tests) is `undefined`.
 *
 * @example readToken(document.documentElement, '--bg-surface') // 'rgb(255, 255, 255)'
 */
export function readToken(root: HTMLElement, token: string): string | undefined {
  const probe = root.ownerDocument.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;background:var(${token})`;
  root.appendChild(probe);
  const color = root.ownerDocument.defaultView?.getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color && color !== 'rgba(0, 0, 0, 0)' ? color : undefined;
}

export const readCanvasColors = (root: HTMLElement = document.documentElement): CanvasColors => ({
  ring: readToken(root, RING_TOKEN),
  inner: readToken(root, INNER_TOKEN),
  theme: root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
});

/**
 * The colours of the rings, which follow the app: the mode, the tone and the accent are attributes on <html>, and any of
 * them changing reads the tokens again.
 *
 * @example const { ring, inner, theme } = useCanvasColors(); <GyroscopeCanvas ringColor={ring} innerColor={inner} theme={theme} />
 */
export function useCanvasColors(
  root: HTMLElement = document.documentElement,
  read: (root: HTMLElement) => CanvasColors = readCanvasColors,
): CanvasColors {
  const [colors, setColors] = useState<CanvasColors>(() => read(root));
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read(root)));
    observer.observe(root, { attributes: true });
    return () => observer.disconnect();
  }, [root, read]);
  return colors;
}
