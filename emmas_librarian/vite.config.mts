import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite plugin to handle PrismJS imports.
 *
 * PrismJS is loaded as static <script> tags in index.html (from public/vendor/prismjs/)
 * so that window.Prism and all language grammars are fully initialized BEFORE the
 * app bundle executes. This avoids the production crash where @lexical/code tries
 * to access deeply nested Prism.languages.markdown properties during synchronous
 * module evaluation.
 *
 * This plugin intercepts all `import "prismjs"` and `import "prismjs/components/*"`
 * statements and replaces them with a module that re-exports window.Prism, making
 * the bundled code work seamlessly with the externally-loaded PrismJS.
 */
function prismjsExternalPlugin(): Plugin {
  const prismjsRe = /^prismjs(\/.*)?$/;

  return {
    name: 'prismjs-external',
    enforce: 'pre',
    resolveId(source) {
      if (prismjsRe.test(source)) {
        // Return a virtual module ID
        return `\0virtual:prismjs-external:${source}`;
      }
      return null;
    },
    load(id) {
      if (id.startsWith('\0virtual:prismjs-external:')) {
        const originalImport = id.replace('\0virtual:prismjs-external:', '');
        if (originalImport === 'prismjs') {
          // The main prismjs import — export the global Prism object
          return 'const Prism = globalThis.Prism || window.Prism; export default Prism; export { Prism };';
        }
        // Component imports (prismjs/components/*) are side-effect-only scripts
        // that mutate window.Prism.languages. Since we already loaded them via
        // <script> tags, this is a no-op.
        return '/* prismjs component already loaded via script tag */';
      }
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    prismjsExternalPlugin(),
    react(),
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
});
