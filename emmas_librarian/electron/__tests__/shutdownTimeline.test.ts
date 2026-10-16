// @vitest-environment node
import { EventEmitter } from 'events';
import { describe, it, expect } from 'vitest';
import { logShutdownTimeline } from '../shutdownTimeline';

class FakeLogger {
  public lines: string[] = [];
  public info(message: string): void {
    this.lines.push(message);
  }
}

describe('logShutdownTimeline', () => {
  function setup() {
    const app = new EventEmitter();
    const logger = new FakeLogger();
    let now = 1000;
    logShutdownTimeline(app, logger, () => now);
    return { app, logger, advance: (ms: number) => (now += ms) };
  }

  it('logs each quit stage as one JSON line with the time since the first', () => {
    const { app, logger, advance } = setup();

    app.emit('before-quit');
    advance(250);
    app.emit('will-quit');
    advance(30_000);
    app.emit('quit');

    expect(logger.lines.map((line) => JSON.parse(line))).toEqual([
      { event: 'shutdown', phase: 'before-quit', msSinceFirst: 0 },
      { event: 'shutdown', phase: 'will-quit', msSinceFirst: 250 },
      { event: 'shutdown', phase: 'quit', msSinceFirst: 30_250 },
    ]);
  });

  it('logs when each window starts to close and has closed', () => {
    const { app, logger, advance } = setup();
    const window = Object.assign(new EventEmitter(), { id: 7 });

    app.emit('browser-window-created', {}, window);
    window.emit('close');
    advance(40);
    window.emit('closed');

    expect(logger.lines.map((line) => JSON.parse(line).phase)).toEqual(['window-7-close', 'window-7-closed']);
  });
});
