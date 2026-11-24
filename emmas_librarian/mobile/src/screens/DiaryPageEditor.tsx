import React, { useState } from 'react';
import type { ProjectWriter } from '../reader/ProjectReader';
import { formatDiaryDay } from './diaryPages';

interface DiaryPageEditorProps {
  projectId: number;
  date: string;
  /** What the page already says, so writing continues it instead of replacing it. */
  current: string;
  writer: ProjectWriter;
  /** What to say after saving: where the page went (the phone, or the computer). */
  savedNote: string;
  isToday: boolean;
  onSaved: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * The text of one diary page, editable, with its save button and the answer to it.
 *
 * @example <DiaryPageEditor projectId={3} date="2026-11-21" current="" writer={writer} savedNote="Salvo no celular." isToday onSaved={reload} />
 */
export const DiaryPageEditor: React.FC<DiaryPageEditorProps> = (props) => {
  const { projectId, date, current, writer, savedNote, isToday, onSaved } = props;
  const [text, setText] = useState(current);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const save = async () => {
    setStatus('saving');
    try {
      await writer.saveDiaryEntry(projectId, date, text);
      setStatus('saved');
      onSaved();
    } catch {
      setStatus('failed');
    }
  };
  return (
    <section>
      <textarea
        className="m-page-text"
        aria-label={isToday ? 'Página de hoje' : `Página de ${formatDiaryDay(date)}`}
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
        {status === 'saved' && savedNote}
        {status === 'failed' && 'Não foi possível salvar. Tente de novo.'}
      </span>
    </section>
  );
};
