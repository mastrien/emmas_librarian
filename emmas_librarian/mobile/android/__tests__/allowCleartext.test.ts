import { describe, it, expect } from 'vitest';
import { allowCleartext } from '../allowCleartext';

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
