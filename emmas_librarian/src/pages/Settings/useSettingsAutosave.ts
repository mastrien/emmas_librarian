import { useEffect, useRef, useState } from 'react';

/** What the settings page shows about saving: nothing yet, a save under way, all saved, or a failure. */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type SaveJob = () => Promise<unknown>;

// Typing waits this long after the last key; a choice (a select) is saved at once.
export const TYPING_DELAY_MS = 600;

/**
 * Saves each setting on its own as it changes, so nothing is lost for want of a "Salvar" click (validation of
 * epic #44: a provider picked but not saved left a whole investigation failing). Each key keeps only its latest
 * value; a key changed again before its delay restarts the wait. Leaving the page saves what is still waiting.
 *
 * @example
 *   const autosave = useSettingsAutosave();
 *   autosave.schedule('api_key_openai', () => service.setSetting('api_key_openai', value));
 */
export function useSettingsAutosave() {
  const pending = useRef(new Map<string, SaveJob>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [status, setStatus] = useState<AutosaveStatus>('idle');

  const run = async (key: string) => {
    const job = pending.current.get(key);
    timers.current.delete(key);
    if (!job) return;
    pending.current.delete(key);
    try {
      await job();
      if (pending.current.size === 0) setStatus('saved');
    } catch (err) {
      console.error(JSON.stringify({ event: 'setting_save_failed', key, error: String(err) }));
      setStatus('error');
    }
  };

  const schedule = (key: string, job: SaveJob, delayMs = TYPING_DELAY_MS) => {
    pending.current.set(key, job);
    clearTimeout(timers.current.get(key));
    setStatus('saving');
    timers.current.set(
      key,
      setTimeout(() => void run(key), delayMs),
    );
  };

  /** Drops what is still waiting under a prefix, e.g. before restoring the AI defaults. */
  const cancel = (prefix: string) => {
    for (const key of [...pending.current.keys()].filter((k) => k.startsWith(prefix))) {
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      pending.current.delete(key);
    }
  };

  useEffect(() => {
    const waiting = pending.current;
    const clocks = timers.current;
    return () => {
      clocks.forEach((t) => clearTimeout(t));
      waiting.forEach((job) => void job());
    };
  }, []);

  return { status, schedule, cancel };
}
