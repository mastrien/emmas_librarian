import React from 'react';
import type { WilsonInterval } from '../../../utils/auditSampling';
import { percent } from '../../../utils/auditQuestions';

// Positions on the 0-100% ruler pass as CSS variables only; audit.css places each mark (Arca 134).
const at = (left: string) => ({ '--at': left }) as React.CSSProperties;
const span = (width: string) => ({ '--span': width }) as React.CSSProperties;

const TICKS = [0, 25, 50, 75, 100];
// Wider than this, the estimate rests on too few marks to lean on; the line is drawn dashed.
const WIDE_INTERVAL = 0.4;

const Ticks: React.FC = () => (
  <>
    {TICKS.map((t) => (
      <span key={t} className={`audit-tick${t === 50 ? ' half' : ''}`} style={at(`${t}%`)} />
    ))}
  </>
);

/**
 * One estimate and its 95% interval on the shared 0-100% axis: a square for the estimate, a line with caps for the
 * interval, dashed when it is wide.
 *
 * Usage:
 *   <ForestPlot interval={wilsonInterval(23, 28)} />
 */
export const ForestPlot: React.FC<{ interval: WilsonInterval | null }> = ({ interval }) => {
  if (!interval) {
    return (
      <div className="audit-forest">
        <Ticks />
        <span className="audit-forest-empty">nada marcado</span>
      </div>
    );
  }
  const width = interval.high - interval.low;
  return (
    <div
      className={`audit-forest${width > WIDE_INTERVAL ? ' wide' : ''}`}
      role="img"
      aria-label={`Estimativa ${percent(interval.estimate)}, IC 95% de ${percent(interval.low)} a ${percent(interval.high)}`}
    >
      <Ticks />
      <span className="audit-whisker" style={{ ...at(`${interval.low * 100}%`), ...span(`${width * 100}%`) }} />
      <span className="audit-cap" style={at(`${interval.low * 100}%`)} />
      <span className="audit-cap audit-cap--high" style={at(`${interval.high * 100}%`)} />
      <span className="audit-point" style={at(`${interval.estimate * 100}%`)} />
    </div>
  );
};

/** The 0% / 50% / 100% labels under a column of forest plots. */
export const AxisScale: React.FC = () => (
  <div className="audit-axis" aria-hidden="true">
    <Ticks />
    {[0, 50, 100].map((t) => (
      <span key={t} className="audit-axis-label" style={at(`${t}%`)}>
        {t}%
      </span>
    ))}
  </div>
);

/** "82% 71–90%": the estimate and its interval as text, or a dash before anything is marked. */
export const RateText: React.FC<{ interval: WilsonInterval | null }> = ({ interval }) =>
  interval ? (
    <span className="audit-rate">
      <b>{percent(interval.estimate)}</b>{' '}
      <span>
        {percent(interval.low)}–{percent(interval.high)}
      </span>
    </span>
  ) : (
    <span className="audit-muted">—</span>
  );
