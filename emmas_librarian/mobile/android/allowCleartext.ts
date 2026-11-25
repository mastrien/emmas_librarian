const ATTRIBUTE = 'android:usesCleartextTraffic="true"';

/**
 * Adds `android:usesCleartextTraffic="true"` to the <application> of an AndroidManifest.xml. The app talks to the
 * computer's plain-HTTP sync port (http://192.168.x.x:47811) and, since Android 9, a target SDK 28+ app may not use
 * cleartext unless the manifest says so. `server.cleartext` in capacitor.config.ts does NOT write this attribute for a
 * project without Cordova plugins, and `npx cap add android` generates the manifest without it (#208).
 *
 * @example allowCleartext('<manifest><application android:label="x"></application></manifest>')
 *   // '<manifest><application android:usesCleartextTraffic="true" android:label="x"></application></manifest>'
 * @throws Error with the start of the file when it has no <application> element
 */
export function allowCleartext(manifest: string): string {
  if (manifest.includes('android:usesCleartextTraffic=')) return manifest;
  if (!/<application[\s>]/.test(manifest)) {
    throw new Error(
      `No <application> element. Offending value: "${manifest.slice(0, 80)}". Expected shape: an AndroidManifest.xml`,
    );
  }
  return manifest.replace(/<application(?=[\s>])/, `<application ${ATTRIBUTE}`);
}
