export interface ShutdownLogger {
  info: (message: string) => void;
}

export interface ShutdownEmitter {
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

interface ClosableWindow extends ShutdownEmitter {
  id?: number;
}

/**
 * Logs, as one JSON line each, when the app starts to quit and when each stage finishes, with the milliseconds
 * since the first one. After "Reiniciar e Instalar" the old version took 16-60 s to quit (#22); the installer waits
 * for it, so this shows in main.log which stage holds the process before anyone guesses a cause.
 *
 * Usage:
 *   logShutdownTimeline(app, log); // once, at startup
 */
export function logShutdownTimeline(
  app: ShutdownEmitter,
  logger: ShutdownLogger,
  clock: () => number = Date.now,
): void {
  let firstEventAt: number | null = null;
  const record = (phase: string): void => {
    const now = clock();
    firstEventAt ??= now;
    logger.info(JSON.stringify({ event: 'shutdown', phase, msSinceFirst: now - firstEventAt }));
  };
  ['before-quit', 'will-quit', 'quit'].forEach((phase) => app.on(phase, () => record(phase)));
  app.on('browser-window-created', (_event, window) => {
    const closable = window as ClosableWindow;
    closable.on('close', () => record(`window-${closable.id ?? '?'}-close`));
    closable.on('closed', () => record(`window-${closable.id ?? '?'}-closed`));
  });
}
