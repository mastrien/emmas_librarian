import React, { useState } from 'react';
import type { Article, PrismaManualCount } from '../../../types';
import { brazilianDate, type PrismaBox, type PrismaFlow, type PrismaWarning } from '../../../utils/prismaFlow';
import { baseName } from '../../../utils/prismaSearches';

const SHOWN = 8;

interface PrismaPanelProps {
  box: PrismaBox;
  flow: PrismaFlow;
  articles: Article[];
  manual: PrismaManualCount | null;
  onSetManual: (value: number | null) => Promise<void>;
}

const WARNING_STYLE: Record<PrismaWarning['kind'], React.CSSProperties> = {
  mismatch: { background: 'var(--review-may-bg)', color: 'var(--review-may-text)', border: '1px solid #d97706' },
  partial: { background: 'var(--review-may-bg)', color: 'var(--review-may-text)', border: '1px solid #d97706' },
  nodata: { background: 'var(--review-rem-bg)', color: 'var(--review-rem-text)', border: '1px solid #0284c7' },
};

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

const ManualEditor: React.FC<Pick<PrismaPanelProps, 'manual' | 'onSetManual'> & { counted: number }> = ({
  manual,
  onSetManual,
  counted,
}) => {
  const [value, setValue] = useState(String(manual?.value ?? counted));
  return (
    <form
      className="prisma-manual"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() !== '') void onSetManual(Number(value));
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontWeight: 600 }}>
        Registros de outras fontes
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: '8rem' }}
        />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        <button type="submit" className="review-small">
          Salvar
        </button>
        {manual && (
          <button type="button" className="review-small" onClick={() => void onSetManual(null)}>
            Voltar à contagem do app ({counted})
          </button>
        )}
      </div>
      <span className="review-muted">
        {manual
          ? `Editado manualmente em ${brazilianDate(manual.updated_at)}.`
          : `O app conta ${counted} artigo(s) adicionados fora das buscas. Digite outro número para registros de fora do app.`}
      </span>
    </form>
  );
};

function articleItems(box: PrismaBox, articles: Article[]) {
  return box.articleIds
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is Article => a !== undefined)
    .map((a) => ({ key: String(a.id), label: a.title, detail: a.year ? String(a.year) : '' }));
}

/**
 * The side panel of the PRISMA tab: the selected box's number, how it is counted, its warnings in full, its
 * lines, and what makes it up (the searches for the identification, the articles for every other box). The
 * identification also takes the number of records from other sources typed by hand.
 *
 * @example <PrismaPanel box={flow.screened} flow={flow} articles={articles} manual={null} onSetManual={save} />
 */
export const PrismaPanel: React.FC<PrismaPanelProps> = ({ box, flow, articles, manual, onSetManual }) => {
  const identification = box.key === 'identified';
  const items = identification ? searchItems(flow) : articleItems(box, articles);
  return (
    <aside aria-label="De onde vem o número" className="review-section prisma-panel">
      <span className="review-menu-title" style={{ padding: 0 }}>
        De onde vem o número
      </span>
      <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{box.title}</h2>
      <strong style={{ fontSize: '1.6rem' }}>n = {box.n}</strong>
      <p style={{ margin: 0, lineHeight: 1.55 }}>{box.how}</p>
      {box.warnings.map((w) => (
        <div key={w.text} role="note" className="prisma-warning" style={WARNING_STYLE[w.kind]}>
          {w.text}
        </div>
      ))}
      {identification && (
        <ManualEditor
          key={manual?.updated_at ?? 'auto'}
          manual={manual}
          onSetManual={onSetManual}
          counted={box.articleIds.length}
        />
      )}
      {box.lines.length > 0 && (
        <ul className="prisma-list" aria-label="Linhas da caixa">
          {box.lines.map((l) => (
            <ItemRow
              key={l.label}
              label={l.label + (l.note ? ` (${l.note})` : '')}
              detail={l.n === null ? 'sem dados' : String(l.n)}
            />
          ))}
        </ul>
      )}
      <ul className="prisma-list" aria-label={identification ? 'Buscas' : 'Artigos'}>
        {items.slice(0, SHOWN).map((item) => (
          <ItemRow key={item.key} label={item.label} detail={item.detail} />
        ))}
      </ul>
      {items.length > SHOWN && <span className="review-muted">e mais {items.length - SHOWN}</span>}
      {items.length === 0 && <span className="review-muted">Nenhum item nesta caixa.</span>}
    </aside>
  );
};
