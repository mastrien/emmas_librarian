import { describe, it, expect } from 'vitest';
import { isHeadlessRun } from '../displayCheck';

describe('isHeadlessRun', () => {
  it('lets a local run go ahead on any platform', () => {
    expect(isHeadlessRun({}, 'linux')).toBe(false);
    expect(isHeadlessRun({}, 'win32')).toBe(false);
  });

  it('lets Windows CI go ahead: its runners have a desktop', () => {
    expect(isHeadlessRun({ CI: 'true' }, 'win32')).toBe(false);
  });

  it('refuses Linux CI without a display server', () => {
    expect(isHeadlessRun({ CI: 'true' }, 'linux')).toBe(true);
  });

  it('lets Linux CI go ahead under Xvfb or Wayland', () => {
    expect(isHeadlessRun({ CI: 'true', DISPLAY: ':99' }, 'linux')).toBe(false);
    expect(isHeadlessRun({ CI: 'true', WAYLAND_DISPLAY: 'wayland-0' }, 'linux')).toBe(false);
  });

  it('refuses whenever HEADLESS_E2E=true, even with a display', () => {
    expect(isHeadlessRun({ HEADLESS_E2E: 'true', DISPLAY: ':0' }, 'win32')).toBe(true);
  });
});
