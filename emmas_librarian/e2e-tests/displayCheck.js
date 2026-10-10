/**
 * Whether this run has no screen for Electron's BrowserWindow, so the E2E suite should stop at once instead of
 * timing out on every launch. Windows always has one. Elsewhere, CI counts as headless unless a display
 * server is up: on Linux CI that is Xvfb (`xvfb-run` sets DISPLAY). HEADLESS_E2E=true forces the refusal.
 *
 * Usage:
 *   if (isHeadlessRun(process.env, process.platform)) throw new Error('...');
 */
function isHeadlessRun(env, platform) {
  if (env.HEADLESS_E2E === 'true') return true;
  if (env.CI !== 'true' || platform === 'win32') return false;
  return !env.DISPLAY && !env.WAYLAND_DISPLAY;
}

module.exports = { isHeadlessRun };
