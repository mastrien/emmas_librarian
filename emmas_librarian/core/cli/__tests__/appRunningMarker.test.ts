// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { clearAppRunning, isAppRunningOn, isProcessAlive, markAppRunning } from '../appRunningMarker';

let userData: string;
const everyoneAlive = () => true;
const nobodyAlive = () => false;

beforeEach(() => {
  userData = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'emma-marker-')), 'userData');
});

afterEach(() => {
  fs.rmSync(path.dirname(userData), { recursive: true, force: true });
});

describe('app running marker', () => {
  it('says the app is not running on a library nobody marked', () => {
    expect(isAppRunningOn(userData, everyoneAlive)).toBe(false);
  });

  it('says the app is running while the marked process is alive, creating the folder if needed', () => {
    markAppRunning(userData, 4242);

    expect(isAppRunningOn(userData, (pid) => pid === 4242)).toBe(true);
  });

  it('treats the marker of a process that died (a crash) as not running', () => {
    markAppRunning(userData, 4242);

    expect(isAppRunningOn(userData, nobodyAlive)).toBe(false);
  });

  it('clears the marker on quit, but not the one another instance wrote since', () => {
    markAppRunning(userData, 4242);
    clearAppRunning(userData, 9999);
    expect(isAppRunningOn(userData, everyoneAlive)).toBe(true);

    clearAppRunning(userData, 4242);
    expect(isAppRunningOn(userData, everyoneAlive)).toBe(false);
  });

  it.each(['not json', '{"pid":"12"}', '{}'])('ignores a damaged marker (%s)', (content) => {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, 'app-running.json'), content);

    expect(isAppRunningOn(userData, everyoneAlive)).toBe(false);
  });
});

describe('isProcessAlive', () => {
  it('finds this process and not an id no process has', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(2 ** 30)).toBe(false);
  });
});
