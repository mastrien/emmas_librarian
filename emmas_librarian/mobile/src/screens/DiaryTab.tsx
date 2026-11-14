import React, { useCallback, useState } from 'react';
import type { DiaryEntry } from '../../../src/types';
import { localIsoDate } from '../../../src/utils/localDate';
import { Await, Empty } from '../components';
import type { ProjectWriter } from '../reader/ProjectReader';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';

const newestFirst = (entries: DiaryEntry[]) => [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
const formatDay = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR', { dateStyle: 'long' });

interface TodayEditorProps {
  projectId: number;
  today: string;
  /** What today's page already says, so writing continues it instead of replacing it. */
  current: string;
  writer: ProjectWriter;
  onSaved: () => void;
}

const TodayEditor: React.FC<TodayEditorProps> = ({ projectId, today, current, writer, onSaved }) => {
  const [text, setText] = useState(current);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const save = async () => {
    setStatus('saving');
    try {
      await writer.saveDiaryEntry(projectId, today, text);
      setStatus('saved');
      onSaved();
    } catch {
      setStatus('failed');
    }
  };
  return (
    <section className="m-card">
      <h2>Hoje, {formatDay(today)}</h2>
      <textarea
        className="m-input m-input--area"
        aria-label="Página de hoje"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setStatus('idle');
        }}
      />
      <button className="m-button m-button--primary" onClick={save} disabled={status === 'saving' || text === current}>
        Salvar página
      </button>
      <span className="m-status" role="status">
        {status === 'saved' && 'Salvo no computador.'}
        {status === 'failed' && 'Não foi possível salvar. Tente de novo.'}
      </span>
    </section>
  );
};

/**
 * The diary of a project, newest page first; where writing is possible, today's page can be written.
 *
 * @example <DiaryTab projectId={3} />
 */
export const DiaryTab: React.FC<{ projectId: number; today?: string }> = ({ projectId, today = localIsoDate() }) => {
  const reader = useReader();
  const diary = useLoaded(useCallback(() => reader.listDiary(projectId), [reader, projectId]));
  return (
    <Await loaded={diary}>
      {(entries) => {
        const current = entries.find((entry) => entry.entry_date === today)?.content ?? '';
        return (
          <>
            {reader.writer && (
              // Not remounted after a save: the text stays as typed and the "saved" note stays on screen.
              <TodayEditor
                projectId={projectId}
                today={today}
                current={current}
                writer={reader.writer}
                onSaved={diary.state === 'ready' ? diary.reload : () => undefined}
              />
            )}
            {entries.length === 0 && <Empty>Nenhuma página no diário.</Empty>}
            {newestFirst(entries).map((entry) => (
              <article key={entry.id} className="m-card">
                <h2>{formatDay(entry.entry_date)}</h2>
                <p className="m-prose">{entry.content}</p>
              </article>
            ))}
          </>
        );
      }}
    </Await>
  );
};
