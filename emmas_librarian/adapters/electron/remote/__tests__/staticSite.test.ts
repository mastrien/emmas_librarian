// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { firstSiteDir, staticSiteIn } from '../staticSite';

let workDir: string;
let siteDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-site-'));
  siteDir = path.join(workDir, 'dist-mobile');
  fs.mkdirSync(path.join(siteDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(siteDir, 'index.html'), '<title>Emma</title>');
  fs.writeFileSync(path.join(siteDir, 'assets', 'app.js'), 'run()');
  fs.writeFileSync(path.join(siteDir, 'manifest.webmanifest'), '{}');
  fs.writeFileSync(path.join(siteDir, 'notes.txt'), 'x');
  fs.writeFileSync(path.join(workDir, 'segredo.json'), '{"token":"x"}');
});

afterEach(() => fs.rmSync(workDir, { recursive: true, force: true }));

describe('staticSiteIn', () => {
  it('answers the index for the root and each file with its content type', () => {
    const site = staticSiteIn(siteDir);

    expect(site('/')).toMatchObject({ status: 200, contentType: 'text/html; charset=utf-8' });
    expect(String(site('/')!.body)).toBe('<title>Emma</title>');
    expect(site('/assets/app.js')).toMatchObject({ contentType: 'text/javascript; charset=utf-8' });
    expect(site('/manifest.webmanifest')?.contentType).toBe('application/manifest+json; charset=utf-8');
  });

  it.each([
    ['a file that is not there', '/assets/nope.js'],
    ['a file type it does not serve', '/notes.txt'],
    ['a folder', '/assets'],
    ['a path that climbs out of the folder', '/../segredo.json'],
    ['a climbing path with encoded dots', '/%2e%2e/segredo.json'],
    ['a climbing path through a subfolder', '/assets/../../segredo.json'],
    ['a malformed percent escape', '/%E0%A4%A'],
  ])('answers nothing for %s', (_label, pathname) => {
    expect(staticSiteIn(siteDir)(pathname)).toBeNull();
  });
});

describe('firstSiteDir', () => {
  it('picks the first folder that holds a built site', () => {
    expect(firstSiteDir([path.join(workDir, 'nada'), workDir, siteDir])).toBe(siteDir);
  });

  it('answers null when none does', () => {
    expect(firstSiteDir([path.join(workDir, 'nada'), workDir])).toBeNull();
  });
});
