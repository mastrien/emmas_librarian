import React from 'react';
import type { Article, PrismaRecords } from '../../../types';
import {
  brazilianDate,
  type PrismaBox,
  type PrismaColumn,
  type PrismaFlow,
  type PrismaLine,
  type PrismaWarning,
} from '../../../utils/prismaFlow';
import { baseName } from '../../../utils/prismaSearches';
import { ArticleOrigins, ProjectSources, type OriginActions } from './PrismaOrigins';
import { StudyGrouping, type StudyActions } from './PrismaStudies';

const SHOWN = 8;

/** Everything the panel's editors can change. */
export type PrismaPanelActions = OriginActions & StudyActions;

interface PrismaPanelProps {
  box: PrismaBox;
  flow: PrismaFlow;
  articles: Article[];
  records: PrismaRecords;
  viaOf: (article: Article) => string;
  actions: PrismaPanelActions;
}

const MAY = { background: 'var(--review-may-bg)', color: 'var(--review-may-text)', border: '1px solid #d97706' };
const WARNING_STYLE: Record<PrismaWarning['kind'], React.CSSProperties> = {
  mismatch: MAY,
  pending: MAY,
  partial: MAY,
  nodata: { background: 'var(--review-rem-bg)', color: 'var(--review-rem-text)', border: '1px solid #0284c7' },
};

const COLUMN_NAMES: Record<PrismaColumn, string> = {
  databases: 'Bases de dados e repositórios',
  other: 'Outros métodos',
  both: 'As duas colunas',
};

// What PRISMA calls a duplicate, next to the box that counts them (#50, from the PRISMA 2020 glossary).
const DUPLICATE_HELP =
  'Para a PRISMA, duplicado é a mesma publicação vinda mais de uma vez. Publicações parecidas (o mesmo resumo em dois congressos) contam como registros diferentes. Um preprint e o artigo publicado também não são duplicados: são duas publicações do mesmo estudo, e isso se marca em "Estudos incluídos".';

const ItemRow: React.FC<{ label: string; detail: string }> = ({ label, detail }) => (
  <li className="prisma-item">
    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
    <span className="review-muted" style={{ flex: 'none' }}>
      {detail}
    </span>
  </li>
);

function searchItems(flow: PrismaFlow) {
  return flow.searches.flatMap((s) =>
    s.bases.map((b) => ({
      key: `${s.searchId}-${b.base}`,
      label: `Busca #${s.searchId} · ${brazilianDate(s.date)} · ${baseName(b.base)}${b.partial ? ' (limite atingido)' : ''}`,
      detail: String(b.count),
    })),
  );
}

function articleItems(box: PrismaBox, articles: Article[]) {
  return box.articleIds
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is Article => a !== undefined)
    .map((a) => ({ key: String(a.id), label: a.title, detail: a.year ? String(a.year) : '' }));
}

const Lines: React.FC<{ lines: PrismaLine[]; label: string }> = ({ lines, label }) =>
  lines.length ? (
    <ul className="prisma-list" aria-label={label}>
      {lines.map((l) => (
        <ItemRow
          key={l.label}
          label={l.label + (l.note ? ` (${l.note})` : '')}
          detail={l.n === null ? 'sem dados' : String(l.n)}
        />
      ))}
    </ul>
  ) : null;

const Items: React.FC<{ box: PrismaBox; flow: PrismaFlow; articles: Article[] }> = ({ box, flow, articles }) => {
  const searchList = box.key === 'identified';
  const items = searchList ? searchItems(flow) : articleItems(box, articles);
  return (
    <>
      <ul className="prisma-list" aria-label={searchList ? 'Buscas' : 'Artigos'}>
        {items.slice(0, SHOWN).map((item) => (
          <ItemRow key={item.key} label={item.label} detail={item.detail} />
        ))}
      </ul>
      {items.length > SHOWN && <span className="review-muted">e mais {items.length - SHOWN}</span>}
      {items.length === 0 && <span className="review-muted">Nenhum item nesta caixa.</span>}
    </>
  );
};

const pick = (box: PrismaBox, articles: Article[]) => articles.filter((a) => box.articleIds.includes(a.id));

// The editors a box has: where articles from outside the searches came from, and which publications are one study.
const Editors: React.FC<PrismaPanelProps> = ({ box, articles, records, viaOf, actions }) => {
  if (box.key === 'omIdentified') {
    return (
      <>
        <ArticleOrigins articles={pick(box, articles)} viaOf={viaOf} records={records} actions={actions} />
        <ProjectSources records={records} onSave={actions.saveSource} />
      </>
    );
  }
  if (box.key === 'included')
    return <StudyGrouping publications={pick(box, articles)} records={records} actions={actions} />;
  return null;
};

/**
 * The side panel of the PRISMA tab: the selected box's column, number, how it is counted, its warnings in full,
 * its lines and finer details, its editors (origins of the articles from outside the searches; publications of
 * the same study) and what makes it up.
 *
 * @example <PrismaPanel box={flow.screened} flow={flow} articles={articles} records={records} viaOf={via} actions={actions} />
 */
export const PrismaPanel: React.FC<PrismaPanelProps> = (props) => {
  const { box, flow, articles } = props;
  return (
    <aside aria-label="De onde vem o número" className="review-section prisma-panel">
      <span className="review-menu-title" style={{ padding: 0 }}>
        De onde vem o número
      </span>
      <span className="review-muted">{COLUMN_NAMES[box.column]}</span>
      <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{box.title}</h2>
      <strong style={{ fontSize: '1.6rem' }}>n = {box.n}</strong>
      <p style={{ margin: 0, lineHeight: 1.55 }}>{box.how}</p>
      {box.warnings.map((w) => (
        <div key={w.text} role="note" className="prisma-warning" style={WARNING_STYLE[w.kind]}>
          {w.text}
        </div>
      ))}
      {box.key === 'removed' && (
        <p className="review-muted" style={{ margin: 0, lineHeight: 1.55 }}>
          {DUPLICATE_HELP}
        </p>
      )}
      <Editors {...props} />
      <Lines lines={box.lines} label="Linhas da caixa" />
      <Lines lines={box.details} label="Detalhes" />
      {box.key !== 'omIdentified' && <Items box={box} flow={flow} articles={articles} />}
    </aside>
  );
};
