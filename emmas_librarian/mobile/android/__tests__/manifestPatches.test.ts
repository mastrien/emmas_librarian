import { describe, it, expect } from 'vitest';
import { addCameraPermission, addScannerModule, allowCleartext, prepareManifest } from '../manifestPatches';

const GENERATED =
  '<manifest>\n    <application\n        android:allowBackup="true"\n        android:label="x">\n    </application>\n</manifest>';

describe('allowCleartext', () => {
  it('puts the attribute on the application element', () => {
    expect(allowCleartext(GENERATED)).toContain(
      '<application android:usesCleartextTraffic="true"\n        android:allowBackup',
    );
  });

  it('works for an application element with no attributes', () => {
    expect(allowCleartext('<manifest><application></application></manifest>')).toContain(
      '<application android:usesCleartextTraffic="true">',
    );
  });

  it('is idempotent', () => {
    const once = allowCleartext(GENERATED);
    expect(allowCleartext(once)).toBe(once);
  });

  it('leaves a manifest that already decides cleartext alone', () => {
    const manifest = '<application android:usesCleartextTraffic="false">';
    expect(allowCleartext(manifest)).toBe(manifest);
  });

  it('names the offending text when there is no application element', () => {
    expect(() => allowCleartext('<manifest/>')).toThrow('Offending value: "<manifest/>"');
  });
});

describe('the other manifest patches', () => {
  it('declares the camera permission once', () => {
    const once = addCameraPermission(GENERATED);
    expect(once).toContain('android.permission.CAMERA');
    expect(addCameraPermission(once)).toBe(once);
  });

  it('puts the scanner module meta-data inside the application', () => {
    const patched = addScannerModule(GENERATED);
    expect(patched.indexOf('mlkit.vision.DEPENDENCIES')).toBeLessThan(patched.indexOf('</application>'));
    expect(addScannerModule(patched)).toBe(patched);
  });

  it('names the offending text when the closing tags are missing', () => {
    expect(() => addCameraPermission('<manifest>')).toThrow('Offending value: "<manifest>"');
    expect(() => addScannerModule('<manifest>')).toThrow('Offending value: "<manifest>"');
  });

  it('prepares a generated manifest in one pass, and a second pass changes nothing', () => {
    const once = prepareManifest(GENERATED);
    expect(once).toContain('usesCleartextTraffic');
    expect(once).toContain('permission.CAMERA');
    expect(prepareManifest(once)).toBe(once);
  });
});
