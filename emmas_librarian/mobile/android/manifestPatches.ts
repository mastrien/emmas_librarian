const ATTRIBUTE = 'android:usesCleartextTraffic="true"';
const CAMERA_PERMISSION = '<uses-permission android:name="android.permission.CAMERA" />';
// Makes Google Play services fetch the QR scanner module when the app is installed, so the first scan does not wait
// for it (@capacitor-mlkit/barcode-scanning README, "Permissions").
const SCANNER_MODULE = '<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />';

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

/**
 * Declares the camera permission the QR reader of the pairing screen asks for (BarcodeScanner.requestPermissions()).
 *
 * @example addCameraPermission('<manifest><application/></manifest>') // '<manifest>...CAMERA..<application/></manifest>'
 */
export function addCameraPermission(manifest: string): string {
  if (manifest.includes('android.permission.CAMERA')) return manifest;
  if (!manifest.includes('</manifest>')) {
    throw new Error(
      `No </manifest>. Offending value: "${manifest.slice(-80)}". Expected shape: an AndroidManifest.xml`,
    );
  }
  return manifest.replace(
    '</manifest>',
    `    ${CAMERA_PERMISSION}
</manifest>`,
  );
}

/** Adds the meta-data that preloads the Google QR scanner module, inside <application>. */
export function addScannerModule(manifest: string): string {
  if (manifest.includes('com.google.mlkit.vision.DEPENDENCIES')) return manifest;
  if (!manifest.includes('</application>')) {
    throw new Error(
      `No </application>. Offending value: "${manifest.slice(0, 80)}". Expected shape: an AndroidManifest.xml`,
    );
  }
  return manifest.replace(
    '</application>',
    `    ${SCANNER_MODULE}
    </application>`,
  );
}

/** Every change the generated manifest needs, in one pass; running it again changes nothing. */
export function prepareManifest(manifest: string): string {
  return addScannerModule(addCameraPermission(allowCleartext(manifest)));
}
