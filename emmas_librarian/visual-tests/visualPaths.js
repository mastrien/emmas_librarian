const os = require('os');
const path = require('path');

/**
 * Where the visual comparison keeps its files, outside the repository: the images show the example project's data.
 * Shared by playwright.visual.config.js and the spec.
 *
 * @example path.join(visualDir(), 'dashboard-claro-1440.png')
 */
function visualDir() {
  return process.env.VISUAL_SNAPSHOT_DIR || path.join(os.tmpdir(), 'emma-visual-baseline');
}

module.exports = { visualDir };
