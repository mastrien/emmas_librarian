import React from 'react';
import { sharePercent, type HomeTotals } from '../homeNumbers';
import '../dashboard.css';

interface TileProps {
  label: string;
  value: number;
  note?: string;
  /** Share of the articles, drawn as a bar under the number. */
  percent?: number;
  tone?: 'ok' | 'accent';
}

const Tile: React.FC<TileProps> = ({ label, value, note, percent, tone = 'accent' }) => (
  <div className="home-tile">
    <span className="home-tile__label">{label}</span>
    <span className="home-tile__value">{value}</span>
    {percent !== undefined && (
      <progress
        max={100}
        value={percent}
        aria-label={`${label}: ${percent}%`}
        className={`home-progress home-progress--${tone}`}
      />
    )}
    {note && <span className="home-tile__note">{note}</span>}
  </div>
);

/**
 * "Visão geral" of every project (board 151), in place of the two pies: the articles, how many were read, how many
 * have a PDF and how many do not.
 *
 * @example <DashboardGlobalStats totals={homeTotals(projects)} />
 */
export const DashboardGlobalStats: React.FC<{ totals: HomeTotals }> = ({ totals }) => (
  <section aria-label="Visão geral" className="home-overview">
    <div className="home-section-head">
      <h2>Visão geral</h2>
      <span className="home-section-head__note">todos os projetos</span>
    </div>
    <div className="home-tiles">
      <Tile label="Artigos" value={totals.total} note={`${totals.active} ativos`} />
      <Tile label="Lidos" value={totals.read} percent={sharePercent(totals.read, totals.total)} tone="ok" />
      <Tile label="Com PDF" value={totals.withPdf} percent={sharePercent(totals.withPdf, totals.total)} />
      <Tile label="Sem PDF" value={totals.withoutPdf} note="sem arquivo vinculado" />
    </div>
  </section>
);
