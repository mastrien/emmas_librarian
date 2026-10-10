// @vitest-environment node
import { spawn } from 'child_process';
import { describe, it, expect } from 'vitest';
import { isProcessAlive, processExited } from '../processExit';

const startNode = (script: string) => spawn(process.execPath, ['-e', script], { stdio: 'ignore' });

describe('isProcessAlive', () => {
  it('sees this process', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('does not see a process that has exited', async () => {
    const child = startNode('process.exit(0)');
    await new Promise((resolve) => child.once('exit', resolve));
    expect(isProcessAlive(child.pid!)).toBe(false);
  });
});

describe('processExited', () => {
  it('resolves once the process exits', async () => {
    const child = startNode('setTimeout(() => process.exit(0), 300)');
    await processExited(child.pid!, 10000, 'the child');
    expect(isProcessAlive(child.pid!)).toBe(false);
  });

  it('rejects naming the process when it outlives the timeout', async () => {
    const child = startNode('setTimeout(() => {}, 30000)');
    try {
      await expect(processExited(child.pid!, 500, 'the child')).rejects.toThrow(
        new RegExp(`Waited 500 ms for the child \\(pid ${child.pid}\\)`),
      );
    } finally {
      child.kill();
    }
  });
});
