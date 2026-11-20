/**
 * Picks which installer the landing page offers, from the visitor's user agent and the assets of the latest release.
 * The page used to always offer the Windows installer, so a Linux visitor never saw the AppImage the releases carry.
 *
 * Usage:
 *   const choice = chooseDownload(navigator.userAgent, release.assets);
 *   // { system: 'linux', asset: {...} | null, label: 'Linux (AppImage)', note: '' }
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EmmaDownload = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MOBILE = /Android|iPhone|iPad|iPod/i;

  // Android reports "Linux" in its user agent, so the phone check has to come first.
  function detectSystem(userAgent) {
    if (MOBILE.test(userAgent)) return 'mobile';
    if (/Windows/i.test(userAgent)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(userAgent)) return 'mac';
    if (/Linux|X11/i.test(userAgent)) return 'linux';
    return 'unknown';
  }

  const INSTALLER = {
    windows: { label: 'Windows', matches: (name) => /\.exe$/i.test(name) },
    linux: { label: 'Linux (AppImage)', matches: (name) => /\.AppImage$/i.test(name) },
  };

  const NOTES = {
    mac: 'Ainda não há versão para Mac. As versões disponíveis são para Windows e Linux.',
    mobile: 'No celular, abra um projeto pelo cliente web, ou baixe o instalador no computador.',
  };

  /** @returns {{system: string, asset: object | null, label: string, note: string}} */
  function chooseDownload(userAgent, assets) {
    const system = detectSystem(String(userAgent || ''));
    const installer = INSTALLER[system];
    const asset = installer ? (assets || []).find((item) => installer.matches(item.name)) || null : null;
    return { system, asset, label: installer ? installer.label : '', note: NOTES[system] || '' };
  }

  return { chooseDownload, detectSystem };
});
