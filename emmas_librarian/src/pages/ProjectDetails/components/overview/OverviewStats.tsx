import React, { useState } from 'react';
import type { Article } from '../../../../types';
import {
  UNKNOWN_PUBLISHER,
  articlesPerBase,
  articlesPerPublisher,
  overviewTiles,
  percentOf,
  yearHistogram,
  type RankedCount,
} from './overviewNumbers';

const Tile: React.FC<{ label: string; value: string | number; children?: React.ReactNode }> = (props) => (
  <div className="overview-tile">
    <span className="overview-label">{props.label}</span>
    <span className="overview-tile__value">{props.value}</span>
    {props.children}
  </div>
);

// A bar's width or height is data, so it stays inline; everything else is in overview.css.
const Progress: React.FC<{ percent: number; tone?: 'ok' }> = ({ percent, tone }) => (
  <div className="overview-progress" role="presentation">
    <i className={tone === 'ok' ? 'is-ok' : undefined} style={{ width: `${percent}%` }} />
  </div>
);

const OverviewTiles: React.FC<{ articles: Article[] }> = ({ articles }) => {
  const t = overviewTiles(articles);
  return (
    <div className="overview-tiles">
      <Tile label="Artigos" value={t.total}>
        <span className="overview-muted">{t.active} ativos</span>
      </Tile>
      <Tile label="Lidos" value={t.read}>
        <Progress percent={percentOf(t.read, t.total)} tone="ok" />
      </Tile>
      <Tile label="Com PDF" value={t.withPdf}>
        <Progress percent={percentOf(t.withPdf, t.total)} />
      </Tile>
      <Tile label="Acesso aberto" value={`${percentOf(t.openAccess, t.total)}%`}>
        <Progress percent={percentOf(t.openAccess, t.total)} />
      </Tile>
    </div>
  );
};

const YearBars: React.FC<{ articles: Article[] }> = ({ articles }) => {
  const { bars, withoutYear } = yearHistogram(articles);
  const highest = Math.max(1, withoutYear, ...bars.map((b) => b.count));
  const range = bars.length ? `${bars[0].year}–${bars[bars.length - 1].year}` : 'Sem anos';
  return (
    <section className="overview-card" aria-label="Artigos por ano">
      <div className="overview-card__head">
        <h2 className="overview-card__title">Artigos por ano</h2>
        <span className="overview-muted">
          {range}
          {withoutYear > 0 && ` · ${withoutYear} sem ano`}
        </span>
      </div>
      <div className="overview-years" role="img" aria-label={`Artigos por ano, ${range}`}>
        {bars.map((b) => (
          <i key={b.year} title={`${b.year}: ${b.count}`} style={{ height: `${(b.count / highest) * 100}%` }} />
        ))}
        {withoutYear > 0 && (
          <i
            className="is-unknown"
            title={`Sem ano: ${withoutYear}`}
            style={{ height: `${(withoutYear / highest) * 100}%` }}
          />
        )}
      </div>
    </section>
  );
};

const RankedBars: React.FC<{ title: string; rows: RankedCount[]; footer?: React.ReactNode }> = (props) => {
  const highest = Math.max(1, ...props.rows.map((r) => r.count));
  return (
    <section className="overview-card" aria-label={props.title}>
      <h2 className="overview-card__title">{props.title}</h2>
      {props.rows.length === 0 && <p className="overview-muted">Nenhum dado ainda.</p>}
      <ul className="overview-ranked">
        {props.rows.map((row) => (
          <li key={row.name} className={row.name === UNKNOWN_PUBLISHER ? 'is-unknown' : undefined}>
            <span className="overview-ranked__name" title={row.name}>
              {row.name}
            </span>
            <i style={{ width: `${(row.count / highest) * 100}%` }} />
            <span className="overview-ranked__count">{row.count}</span>
          </li>
        ))}
      </ul>
      {props.footer}
    </section>
  );
};

const PublisherBars: React.FC<{ articles: Article[] }> = ({ articles }) => {
  const [showTen, setShowTen] = useState(false);
  const all = articlesPerPublisher(articles);
  const toggle = all.length > 3 && (
    <button type="button" className="overview-link" onClick={() => setShowTen((v) => !v)}>
      {showTen ? 'Ver as 3 maiores' : `Ver as ${Math.min(10, all.length)} maiores`}
    </button>
  );
  return <RankedBars title="Editoras" rows={all.slice(0, showTen ? 10 : 3)} footer={toggle} />;
};

/**
 * The compact numbers beside "Sobre o projeto" (board 154): tiles, articles per year, bases and publishers.
 *
 * @example <OverviewStats articles={articles} />
 */
export const OverviewStats: React.FC<{ articles: Article[] }> = ({ articles }) => (
  <aside className="overview-stats" aria-label="Números do projeto">
    <OverviewTiles articles={articles} />
    <YearBars articles={articles} />
    <RankedBars title="Bases de origem" rows={articlesPerBase(articles)} />
    <PublisherBars articles={articles} />
  </aside>
);
