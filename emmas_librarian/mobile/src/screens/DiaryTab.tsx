import React, { useCallback, useState } from 'react';
import type { DiaryEntry } from '../../../src/types';
import { localIsoDate } from '../../../src/utils/localDate';
import { Await, Empty } from '../components';
import { Markdown } from '../Markdown';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';
import { DiaryCalendarSheet } from './DiaryCalendarSheet';
import { DiaryPageEditor } from './DiaryPageEditor';
import { DiaryPager } from './DiaryPager';
import { diaryLabel, neighbour, openingDate, pageDates } from './diaryPages';

interface BodyProps {
  entries: DiaryEntry[];
  projectId: number;
  today: string;
  reload: () => void;
}

/** Which page is on screen and whether the calendar is open; `go` changes the page and closes the calendar. */
function useDiaryNavigation(entries: DiaryEntry[], today: string, writable: boolean) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const go = (next: string) => {
    setChosen(next);
    setSheetOpen(false);
  };
  return {
    date: chosen ?? openingDate(entries, today, writable),
    dates: pageDates(entries, today, writable),
    sheetOpen,
    setSheetOpen,
    go,
  };
}

const DiaryBody: React.FC<BodyProps> = ({ entries, projectId, today, reload }) => {
  const reader = useReader();
  const writer = reader.writer;
  const { date, dates, sheetOpen, setSheetOpen, go } = useDiaryNavigation(entries, today, writer !== null);
  if (!date) return <Empty>Nenhuma página no diário.</Empty>;

  const content = entries.find((entry) => entry.entry_date === date)?.content ?? '';
  return (
    <>
      <DiaryPager
        label={diaryLabel(date, today)}
        previous={neighbour(dates, date, -1)}
        next={neighbour(dates, date, 1)}
        onGo={go}
        onOpenCalendar={() => setSheetOpen(true)}
      />
      {writer ? (
        // Keyed by the page only: a reload after saving keeps the text and the "saved" note on screen.
        <DiaryPageEditor
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
        <DiaryCalendarSheet
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
  const reload = diary.state === 'ready' ? diary.reload : () => undefined;
  return (
    <Await loaded={diary}>
      {(entries) => <DiaryBody entries={entries} projectId={projectId} today={today} reload={reload} />}
    </Await>
  );
};
