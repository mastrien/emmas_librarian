import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import { DiaryEditor } from './DiaryEditor';
import { DiaryPageToolbar, type DiaryMode } from './DiaryPageToolbar';
import { formatDiaryDate } from './diaryDates';
import { useDiaryPageSave } from './useDiaryPageSave';

/** What the diary asks of the page it has open. */
export interface DiaryPageHandle {
  /** Saves what is waiting, so the next read (the versions) sees it. */
  flush: () => Promise<void>;
  /** Forgets what is waiting: the page is about to be deleted, and saving it would bring it back. */
  discard: () => void;
}

interface DiaryPageProps {
  projectId: number;
  date: string;
  mode: DiaryMode;
  onModeChange: (mode: DiaryMode) => void;
  /** Told after each save, so the page list shows the new first line. */
  onSaved: (date: string, text: string) => void;
  onOpenHistory: () => void;
  onDelete: () => void;
  /** Read the page again: it changed somewhere else. */
  onReload: () => void;
}

// The page reads its own text when it opens. Used with a key of its project and date, the text that arrives is always
// the text of the page that asked, and a page left before the answer ignores it.
function usePageContent(projectId: number, date: string): { content: string | null; failed: boolean } {
  const service = useProjectService();
  const [state, setState] = useState<{ content: string | null; failed: boolean }>({ content: null, failed: false });
  useEffect(() => {
    let current = true;
    service
      .getDiaryEntry(projectId, date)
      .then((entry) => current && setState({ content: entry?.content ?? '', failed: false }))
      .catch((err: unknown) => {
        console.error('Failed to open diary page:', err);
        if (current) setState({ content: null, failed: true });
      });
    return () => {
      current = false;
    };
  }, [service, projectId, date]);
  return state;
}

type BodyProps = DiaryPageProps & { initialContent: string };

const DiaryPageBody = forwardRef<DiaryPageHandle, BodyProps>(function DiaryPageBody(props, ref) {
  const { projectId, date, initialContent, onSaved } = props;
  const save = useDiaryPageSave({ projectId, date, initialContent, onSaved });
  useImperativeHandle(ref, () => ({ flush: save.flush, discard: save.discard }), [save.flush, save.discard]);
  return (
    <>
      <DiaryPageToolbar
        mode={props.mode}
        onModeChange={props.onModeChange}
        saving={save.status.saving}
        hasChanges={save.status.dirty}
        savedAt={save.status.savedAt}
        problem={save.status.problem}
        onReload={props.onReload}
        onOpenHistory={props.onOpenHistory}
        onDelete={props.onDelete}
      />
      <article className="diary-doc">
        <h2 className="diary-label diary-doc__date">{formatDiaryDate(date)}</h2>
        <DiaryEditor initialMarkdown={initialContent} readOnly={props.mode === 'read'} onChange={save.change} />
      </article>
    </>
  );
});

/**
 * One open diary page: its bar, its date and its editor, with its own saving. Mount it with a key made of the project,
 * the date and a version number: opening another page, or reading this one again, is a new page, never the same editor
 * given other text.
 *
 * Usage:
 *   <DiaryPage key={`${projectId}:${date}:${version}`} ref={pageRef} projectId={projectId} date={date} mode={mode} … />
 */
export const DiaryPage = forwardRef<DiaryPageHandle, DiaryPageProps>(function DiaryPage(props, ref) {
  const { content, failed } = usePageContent(props.projectId, props.date);
  if (content === null) {
    return (
      <article className="diary-doc">
        <h2 className="diary-label diary-doc__date">{formatDiaryDate(props.date)}</h2>
        {failed && <p className="diary-save diary-save--pending">Não foi possível abrir esta página.</p>}
      </article>
    );
  }
  return <DiaryPageBody ref={ref} {...props} initialContent={content} />;
});
