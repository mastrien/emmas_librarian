import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const modeOf = (root: HTMLElement): ThemeMode => (root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

/**
 * The colour mode the app is in now ("data-theme" on <html>, which the appearance settings write), kept up to date
 * when it changes, so a canvas that cannot read CSS variables still matches the page.
 *
 * @example const theme = useThemeMode(); <GyroscopeCanvas theme={theme} />
 */
export function useThemeMode(root: HTMLElement = document.documentElement): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(() => modeOf(root));
  useEffect(() => {
    const observer = new MutationObserver(() => setMode(modeOf(root)));
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [root]);
  return mode;
}
