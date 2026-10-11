/**
 * Fake child_process.execFile: records how the process would have been started and finishes at once with the
 * outcome it was given, instead of starting Electron.
 *
 * Usage:
 *   const launcher = new FakeExecFile({ stdout: 'hello' });
 *   await runAppUntilExit({}, { userDataDir, execFileImpl: launcher.execFile });
 *   expect(launcher.calls[0].args).toContain('--remote-debugging-port=0');
 */
class FakeExecFile {
  constructor({ error = null, stdout = '', stderr = '' } = {}) {
    this.outcome = { error, stdout, stderr };
    this.calls = [];
  }

  execFile = (binary, args, options, callback) => {
    this.calls.push({ binary, args, options });
    const { error, stdout, stderr } = this.outcome;
    callback(error, stdout, stderr);
  };
}

module.exports = { FakeExecFile };
