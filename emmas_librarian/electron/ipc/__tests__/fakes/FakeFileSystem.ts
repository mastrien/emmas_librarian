type FailableOperation = 'copyFileSync' | 'unlinkSync';

/**
 * Named in-memory fake for the subset of `fs` used by the IPC layer. Files are
 * Buffers keyed by the exact path string; directories are tracked separately.
 * `failNext` makes the next call of an operation throw, to exercise recovery.
 *
 * Usage:
 *   const disk = new FakeFileSystem();
 *   disk.addFile('/in/paper.pdf', 'pdf-bytes');
 *   disk.failNext('copyFileSync', new Error('EACCES'));
 */
export class FakeFileSystem {
  readonly files = new Map<string, Buffer>();
  readonly dirs = new Set<string>();
  private readonly pendingFailures = new Map<FailableOperation, Error>();

  addFile(filePath: string, content: string | Buffer): void {
    this.files.set(filePath, Buffer.from(content));
  }

  failNext(operation: FailableOperation, error: Error): void {
    this.pendingFailures.set(operation, error);
  }

  existsSync = (target: string): boolean => this.files.has(target) || this.dirs.has(target);

  mkdirSync = (dir: string): void => {
    this.dirs.add(dir);
  };

  readFileSync = (filePath: string): Buffer => {
    const content = this.files.get(filePath);
    if (!content) throw Object.assign(new Error(`ENOENT: no such file, open '${filePath}'`), { code: 'ENOENT' });
    return content;
  };

  writeFileSync = (filePath: string, content: string | Buffer): void => {
    this.files.set(filePath, Buffer.from(content));
  };

  copyFileSync = (source: string, destination: string): void => {
    this.throwIfPending('copyFileSync');
    this.files.set(destination, this.readFileSync(source));
  };

  unlinkSync = (filePath: string): void => {
    this.throwIfPending('unlinkSync');
    this.files.delete(filePath);
  };

  statSync = (filePath: string): { size: number } => ({ size: this.readFileSync(filePath).length });

  reset(): void {
    this.files.clear();
    this.dirs.clear();
    this.pendingFailures.clear();
  }

  private throwIfPending(operation: FailableOperation): void {
    const error = this.pendingFailures.get(operation);
    if (!error) return;
    this.pendingFailures.delete(operation);
    throw error;
  }
}
