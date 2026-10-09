// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { INSTALLER_CRASH, runInstallerOnce, type InstallerResult } from '../installerRun';

const exited = (status: number): InstallerResult => ({ status, signal: null });

/** Answers each start of the installer with the next scripted result and counts the starts. */
class ScriptedInstaller {
  public starts = 0;
  constructor(private readonly results: InstallerResult[]) {}

  public readonly run = (): InstallerResult => {
    this.starts += 1;
    return this.results[this.starts - 1] ?? this.results[this.results.length - 1];
  };
}

describe('runInstallerOnce', () => {
  it('starts an installer that works only once', () => {
    const installer = new ScriptedInstaller([exited(0)]);

    const outcome = runInstallerOnce(installer.run, true);

    expect(installer.starts).toBe(1);
    expect(outcome).toEqual({ result: exited(0), crashedFirst: false });
  });

  it('starts a tolerated installer again after the access violation and reports the crash', () => {
    const installer = new ScriptedInstaller([exited(INSTALLER_CRASH), exited(0)]);

    const outcome = runInstallerOnce(installer.run, true);

    expect(installer.starts).toBe(2);
    expect(outcome).toEqual({ result: exited(0), crashedFirst: true });
  });

  it('gives a tolerated installer only one more chance', () => {
    const installer = new ScriptedInstaller([exited(INSTALLER_CRASH)]);

    const outcome = runInstallerOnce(installer.run, true);

    expect(installer.starts).toBe(2);
    expect(outcome.result.status).toBe(INSTALLER_CRASH);
  });

  it('does not start the installer of the build under test again after a crash', () => {
    const installer = new ScriptedInstaller([exited(INSTALLER_CRASH), exited(0)]);

    const outcome = runInstallerOnce(installer.run, false);

    expect(installer.starts).toBe(1);
    expect(outcome).toEqual({ result: exited(INSTALLER_CRASH), crashedFirst: true });
  });

  it.each([1, 2, 5])('does not start again after a different failure (status %i)', (status) => {
    const installer = new ScriptedInstaller([exited(status), exited(0)]);

    const outcome = runInstallerOnce(installer.run, true);

    expect(installer.starts).toBe(1);
    expect(outcome).toEqual({ result: exited(status), crashedFirst: false });
  });
});
