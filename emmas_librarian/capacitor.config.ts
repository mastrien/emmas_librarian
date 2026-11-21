import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The phone app (docs/planos/2026-11-21_mobile_robusto.md): the same build as the web client (`dist-mobile/`), run in
 * Android's WebView. Cleartext is allowed because the app talks to the computer's sync port over plain HTTP on the
 * local network; everything of value on it is already sealed by the secure channel (core/sync/crypto).
 *
 * Build and run (needs the Android SDK, which is not part of this repository's CI):
 *   npm run build:mobile && npx cap add android && npx cap sync android && npx cap open android
 */
const config: CapacitorConfig = {
  appId: 'app.emmaslibrarian.mobile',
  appName: "Emma's Librarian",
  webDir: 'dist-mobile',
  server: {
    // Served from https://localhost inside the WebView; the sync calls go out to http://<computer>:<port>.
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
