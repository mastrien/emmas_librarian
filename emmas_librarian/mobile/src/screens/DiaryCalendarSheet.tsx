import React from 'react';
import { monthGrid } from './diaryPages';

interface DiaryCalendarSheetProps {
  /** The date on screen: its month is the one shown. */
  current: string;
  today: string;
  /** Dates that have a page; they are marked with a dot. */
  datesWithPage: string[];
  /** Where writing is possible a day without a page can be opened too, to write it. */
  canWriteAnyDay: boolean;
  onPick: (date: string) => void;
  onClose: () => void;
}

/**
 * The month of the diary as a sheet over the screen: tap a day to go to its page, or "Ir para hoje".
 *
 * @example <DiaryCalendarSheet current="2026-11-21" today="2026-11-21" datesWithPage={dates} canWriteAnyDay onPick={go} onClose={close} />
 */
export const DiaryCalendarSheet: React.FC<DiaryCalendarSheetProps> = (props) => {
  const grid = monthGrid(props.current);
  return (
    <div className="m-sheet">
      <div className="m-sheet__body" role="dialog" aria-label="Escolher página do diário">
        <h2>{grid.title}</h2>
        <div className="m-calendar">
          {Array.from({ length: grid.leadingBlanks }, (_unused, index) => (
            <span key={`blank-${index}`} />
          ))}
          {grid.days.map((day) => (
            <DayButton key={day} day={day} {...props} />
          ))}
        </div>
        <button className="m-button" onClick={() => props.onPick(props.today)}>
          Ir para hoje
        </button>
        <button className="m-button" onClick={props.onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
};

const DayButton: React.FC<DiaryCalendarSheetProps & { day: string }> = (props) => {
  const has = props.datesWithPage.includes(props.day);
  const classes = [has ? 'has-page' : '', props.day === props.current ? 'is-current' : ''].filter(Boolean).join(' ');
  return (
    <button
      aria-label={`Dia ${Number(props.day.slice(8))}`}
      disabled={!has && !props.canWriteAnyDay}
      className={classes}
      onClick={() => props.onPick(props.day)}
    >
      {Number(props.day.slice(8))}
    </button>
  );
};
