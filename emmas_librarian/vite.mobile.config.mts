import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The mobile client (#33): its own page, built to dist-mobile/. The desktop app serves that folder
// from its LAN server, and the same build is published on the web for opening project files offline.
// Relative base, so it works at the root of the desktop's server and under a folder on the web.
export default defineConfig({
  root: path.resolve(__dirname, 'mobile'),
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist-mobile'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
});
