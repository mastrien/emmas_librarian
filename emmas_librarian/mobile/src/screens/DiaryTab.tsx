import React, { useCallback, useState } from 'react';
import type { DiaryEntry } from '../../../src/types';
import { localIsoDate } from '../../../src/utils/localDate';
import { Await, Empty } from '../components';
import { Markdown } from '../Markdown';
import type { ProjectWriter } from '../reader/ProjectReader';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';
import { monthGrid, neighbour, openingDate, pageDates } from './diaryPages';

const formatDay = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR', { dateStyle: 'long' });
const labelOf = (isoDate: string, today: string) =>
  isoDate === today ? `Hoje · ${formatDay(isoDate)}` : formatDay(isoDate);

interface EditorProps {
  projectId: number;
  date: string;
  /** What the page already says, so writing continues it instead of replacing it. */
  current: string;
  writer: ProjectWriter;
  savedNote: string;
  isToday: boolean;
  onSaved: () => void;
}

const PageEditor: React.FC<EditorProps> = ({ projectId, date, current, writer, savedNote, isToday, onSaved }) => {
  const [text, setText] = useState(current);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
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
        aria-label={isToday ? 'Página de hoje' : `Página de ${formatDay(date)}`}
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

interface SheetProps {
  current: string;
  today: string;
  datesWithPage: string[];
  canWriteAnyDay: boolean;
  onPick: (date: string) => void;
  onClose: () => void;
}

const CalendarSheet: React.FC<SheetProps> = ({ current, today, datesWithPage, canWriteAnyDay, onPick, onClose }) => {
  const grid = monthGrid(current);
  return (
    <div className="m-sheet">
      <div className="m-sheet__body" role="dialog" aria-label="Escolher página do diário">
        <h2>{grid.title}</h2>
        <div className="m-calendar">
          {Array.from({ length: grid.leadingBlanks }, (_unused, index) => (
            <span key={`blank-${index}`} />
          ))}
          {grid.days.map((day) => {
            const has = datesWithPage.includes(day);
            const reachable = has || canWriteAnyDay;
            return (
              <button
                key={day}
                aria-label={`Dia ${Number(day.slice(8))}`}
                disabled={!reachable}
                className={`${has ? 'has-page' : ''}${day === current ? ' is-current' : ''}`}
                onClick={() => onPick(day)}
              >
                {Number(day.slice(8))}
              </button>
            );
          })}
        </div>
        <button className="m-button" onClick={() => onPick(today)}>
          Ir para hoje
        </button>
        <button className="m-button" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
};

const Pager: React.FC<{
  label: string;
  previous: string | null;
  next: string | null;
  onGo: (date: string) => void;
  onOpen: () => void;
}> = (props) => (
  <div className="m-pager">
    <button
      aria-label="Página anterior"
      disabled={!props.previous}
      onClick={() => props.previous && props.onGo(props.previous)}
    >
      ‹
    </button>
    <button aria-label="Escolher outra página" aria-haspopup="dialog" onClick={props.onOpen}>
      {props.label} ▾
    </button>
    <button aria-label="Próxima página" disabled={!props.next} onClick={() => props.next && props.onGo(props.next)}>
      ›
    </button>
  </div>
);

interface BodyProps {
  entries: DiaryEntry[];
  projectId: number;
  today: string;
  reload: () => void;
}

const DiaryBody: React.FC<BodyProps> = ({ entries, projectId, today, reload }) => {
  const reader = useReader();
  const writer = reader.writer;
  const [chosen, setChosen] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const date = chosen ?? openingDate(entries, today, writer !== null);
  if (!date) return <Empty>Nenhuma página no diário.</Empty>;

  const dates = pageDates(entries, today, writer !== null);
  const content = entries.find((entry) => entry.entry_date === date)?.content ?? '';
  const go = (next: string) => {
    setChosen(next);
    setSheetOpen(false);
  };
  return (
    <>
      <Pager
        label={labelOf(date, today)}
        previous={neighbour(dates, date, -1)}
        next={neighbour(dates, date, 1)}
        onGo={go}
        onOpen={() => setSheetOpen(true)}
      />
      {writer ? (
        // Keyed by the page only: a reload after saving keeps the text and the "saved" note on screen.
        <PageEditor
          key={date}
          projectId={projectId}
          date={date}
          current={content}
          writer={writer}
          isToday={date === today}
          savedNote={reader.source === 'local' ? 'Salvo no celular.' : 'Salvo no computador.'}
          onSaved={reload}
        />
      ) : (
        <article className="m-card">
          <Markdown text={content} />
        </article>
      )}
      {sheetOpen && (
        <CalendarSheet
          current={date}
          today={today}
          datesWithPage={dates}
          canWriteAnyDay={writer !== null}
          onPick={go}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
};

/**
 * The diary of a project, one page at a time: arrows for the page before and after, and the date opens a calendar
 * to jump. Where writing is possible the page is an editor, and today's page is always there to write.
 *
 * @example <DiaryTab projectId={3} />
 */
export const DiaryTab: React.FC<{ projectId: number; today?: string }> = ({ projectId, today = localIsoDate() }) => {
  const reader = useReader();
  const diary = useLoaded(useCallback(() => reader.listDiary(projectId), [reader, projectId]));
  return (
    <Await loaded={diary}>
      {(entries) => (
        <DiaryBody
          entries={entries}
          projectId={projectId}
          today={today}
          reload={diary.state === 'ready' ? diary.reload : () => undefined}
        />
      )}
    </Await>
  );
};
