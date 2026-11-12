import { useEffect, useMemo, useState } from 'react';

/** The tokens of the app the rings take their colours from: a quiet tone for the ring, the page's for its inside. */
export const RING_TOKEN = '--bg-sunken';
/** The accent the person chose, for the rings that stand beside an answer. */
export const ACCENT_TOKEN = '--color-primary';
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

export const readCanvasColors = (
  root: HTMLElement = document.documentElement,
  ringToken: string = RING_TOKEN,
): CanvasColors => ({
  ring: readToken(root, ringToken),
  inner: readToken(root, INNER_TOKEN),
  theme: root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
});

/**
 * The colours of the rings, which follow the app: the mode, the tone and the accent are attributes on <html>, and any of
 * them changing reads the tokens again. `ringToken` names the token of the ring: the quiet one by default, or the accent.
 *
 * @example const { ring, inner, theme } = useCanvasColors(ACCENT_TOKEN); <GyroscopeCanvas ringColor={ring} innerColor={inner} theme={theme} />
 */
export function useCanvasColors(
  ringToken: string = RING_TOKEN,
  root: HTMLElement = document.documentElement,
  read: (root: HTMLElement, ringToken: string) => CanvasColors = readCanvasColors,
): CanvasColors {
  // The page changing only says "read again"; the colours themselves are worked out from the page and the token.
  const [changes, setChanges] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setChanges((count) => count + 1));
    observer.observe(root, { attributes: true });
    return () => observer.disconnect();
  }, [root]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- "changes" is the reason to read again, not a value used here
  const colors = useMemo(() => read(root, ringToken), [root, read, ringToken, changes]);
  return colors;
}
