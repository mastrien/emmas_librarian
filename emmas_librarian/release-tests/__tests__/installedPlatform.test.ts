// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installedAppPlatform } from '../installedPlatform';
import { installAppImage } from '../linuxInstall';

describe('installedAppPlatform', () => {
  it('installs NSIS on Windows, with the library under %APPDATA%', () => {
    const windows = installedAppPlatform('win32', { APPDATA: 'C:\\Users\\a\\AppData\\Roaming' }, 'C:\\app');
    expect(windows.userData).toBe(path.join('C:\\Users\\a\\AppData\\Roaming', 'emmas_librarian'));
    expect(windows.appExecutable).toBe(path.join('C:\\app', "Emma's Librarian.exe"));
    expect([windows.updateMetadataFile, windows.installerExtension]).toEqual(['latest.yml', '.exe']);
  });

  it('uses an AppImage on Linux, with the library under $XDG_CONFIG_HOME', () => {
    const linux = installedAppPlatform('linux', { XDG_CONFIG_HOME: '/home/a/.config' }, '/opt/app');
    expect(linux.userData).toBe(path.join('/home/a/.config', 'emmas_librarian'));
    expect(linux.appExecutable).toBe(path.join('/opt/app', 'emmas-librarian.AppImage'));
    expect([linux.updateMetadataFile, linux.installerExtension]).toEqual(['latest-linux.yml', '.AppImage']);
  });

  it('falls back to ~/.config on Linux, as Electron does without XDG_CONFIG_HOME', () => {
    expect(installedAppPlatform('linux', {}, '/opt/app').userData).toBe(
      path.join(os.homedir(), '.config', 'emmas_librarian'),
    );
  });

  it('refuses a platform the release test does not cover, naming it', () => {
    expect(() => installedAppPlatform('darwin', {}, '/app')).toThrow(/"darwin".*Expected win32 or linux/);
  });
});

describe('installAppImage', () => {
  let folder: string;
  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-appimage-'));
  });
  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  const write = (name: string, content: string) => {
    const file = path.join(folder, name);
    fs.writeFileSync(file, content);
    return file;
  };

  it('puts the AppImage in place, creating the folder', () => {
    const target = path.join(folder, 'app', 'emmas-librarian.AppImage');
    installAppImage(write('v1.AppImage', 'version 1'), target);
    expect(fs.readFileSync(target, 'utf-8')).toBe('version 1');
    expect(fs.existsSync(`${target}.new`)).toBe(false);
  });

  it('replaces an installed AppImage, as an update does', () => {
    const target = path.join(folder, 'emmas-librarian.AppImage');
    installAppImage(write('v1.AppImage', 'version 1'), target);
    installAppImage(write('v2.AppImage', 'version 2'), target);
    expect(fs.readFileSync(target, 'utf-8')).toBe('version 2');
  });

  it.skipIf(process.platform === 'win32')('makes it executable', () => {
    const target = path.join(folder, 'emmas-librarian.AppImage');
    installAppImage(write('v1.AppImage', 'version 1'), target);
    expect(fs.statSync(target).mode & 0o111).toBe(0o111);
  });

  it('names the missing file', () => {
    expect(() => installAppImage(path.join(folder, 'nope.AppImage'), path.join(folder, 'x'))).toThrow(
      /nope\.AppImage.*Expected an electron-builder \.AppImage/,
    );
  });
});
