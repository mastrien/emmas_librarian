import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';

export const AUTOSAVE_DELAY_MS = 2000;

/** The code the main process gives a diary page that changed since it was read. */
export const DIARY_CONFLICT = 'ERR_DIARY_CONFLICT';

export interface DiarySaveStatus {
  saving: boolean;
  /** There is text the database does not have yet. */
  dirty: boolean;
  /** When the page was last saved in this visit, "HH:MM". */
  savedAt: string | null;
  /** "conflict": the page changed somewhere else and nothing more is written from here; "failed": it can be tried again. */
  problem: 'conflict' | 'failed' | null;
}

const IDLE: DiarySaveStatus = { saving: false, dirty: false, savedAt: null, problem: null };

const clockTime = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const isConflict = (err: unknown): boolean => (err as { code?: string } | null)?.code === DIARY_CONFLICT;

interface DiaryPageSaveOptions {
  projectId: number;
  /** The one page this belongs to: it saves nothing else, whatever else is on screen. */
  date: string;
  /** What the database holds for the page now; it is what a save must find there (see HistoryRepository). */
  initialContent: string;
  onSaved: (date: string, text: string) => void;
  delayMs?: number;
}

/**
 * The saving of ONE diary page. The page is its own instance (keyed by its date), so the text it saves is always the
 * text of its own editor and the date it saves under is always its own: a late answer or a late event of another page
 * has nowhere to land. A write also says which text it expects to replace, so the database refuses it if the page
 * changed meanwhile instead of overwriting.
 *
 * Saving waits for a pause in typing, happens at once on `flush`, and on the way out if a change is still waiting.
 * Edits the editor makes by itself when it loads the text (normalizing it) are not changes.
 *
 * @example const save = useDiaryPageSave({ projectId, date, initialContent, onSaved }); <Editor onChange={save.change} />
 */
export function useDiaryPageSave({
  projectId,
  date,
  initialContent,
  onSaved,
  delayMs = AUTOSAVE_DELAY_MS,
}: DiaryPageSaveOptions) {
  const service = useProjectService();
  const serviceRef = useRef(service);
  const onSavedRef = useRef(onSaved);
  const baseline = useRef(initialContent);
  const pending = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const blocked = useRef(false);
  const [status, setStatus] = useState<DiarySaveStatus>(IDLE);
  useEffect(() => {
    serviceRef.current = service;
    onSavedRef.current = onSaved;
  });

  const clear = useCallback(() => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  }, []);

  const write = useCallback(
    async (text: string) => {
      setStatus((s) => ({ ...s, saving: true }));
      try {
        await serviceRef.current.saveDiaryEntry(projectId, date, text, baseline.current);
        baseline.current = text;
        onSavedRef.current(date, text);
        setStatus({ saving: false, dirty: pending.current !== null, savedAt: clockTime(), problem: null });
      } catch (err) {
        blocked.current = isConflict(err);
        if (!blocked.current) console.error('Failed to save diary page:', err);
        setStatus((s) => ({ ...s, saving: false, problem: blocked.current ? 'conflict' : 'failed' }));
      }
    },
    [projectId, date],
  );

  const flush = useCallback(async () => {
    const waiting = pending.current;
    clear();
    if (waiting && !blocked.current) await write(waiting.text);
  }, [clear, write]);

  const discard = useCallback(() => {
    clear();
    setStatus((s) => (s.dirty ? { ...s, dirty: false } : s));
  }, [clear]);

  const change = useCallback(
    (markdown: string, normalizing = false) => {
      if (normalizing || blocked.current) return;
      clear();
      if (markdown === baseline.current) return setStatus((s) => (s.dirty ? { ...s, dirty: false } : s));
      setStatus((s) => (s.dirty ? s : { ...s, dirty: true }));
      // An emptied page keeps what it had: deleting a page is its own button.
      if (!markdown.trim()) return;
      pending.current = {
        text: markdown,
        timer: setTimeout(() => {
          pending.current = null;
          void write(markdown);
        }, delayMs),
      };
    },
    [clear, write, delayMs],
  );

  // On the way out (another page opened, the diary closed) a change still waiting is saved, under this page's date.
  useEffect(
    () => () => {
      const waiting = pending.current;
      if (!waiting || blocked.current) return;
      clearTimeout(waiting.timer);
      serviceRef.current
        .saveDiaryEntry(projectId, date, waiting.text, baseline.current)
        .catch((err: unknown) => console.error('Failed to save diary page on leaving:', err));
    },
    [projectId, date],
  );

  return { status, change, flush, discard };
}
