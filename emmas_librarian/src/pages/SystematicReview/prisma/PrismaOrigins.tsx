import React, { useState } from 'react';
import type { Article, PrismaRecords, PrismaSourceInput, PrismaSourceMethod } from '../../../types';
import { brazilianDate, METHOD_NAMES } from '../../../utils/prismaFlow';

/** What the origin editor can change; each call answers the records as they now are. */
export interface OriginActions {
  saveSource: (input: PrismaSourceInput) => Promise<void>;
  setOrigins: (articleIds: number[], sourceId: number | null) => Promise<void>;
}

// Long option names must shrink with the panel, never push past it (the #50 mock-up's select did).
const FIELD: React.CSSProperties = { width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' };
const LABEL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' };
const METHODS = Object.keys(METHOD_NAMES) as PrismaSourceMethod[];

const SourceOptions: React.FC<{ records: PrismaRecords }> = ({ records }) => (
  <>
    {records.sources.map((s) => (
      <option key={s.id} value={s.id}>
        {s.name} ({METHOD_NAMES[s.method]})
      </option>
    ))}
  </>
);

const OriginRow: React.FC<{
  article: Article;
  via: string;
  records: PrismaRecords;
  checked: boolean;
  onCheck: () => void;
  onPick: (sourceId: number | null) => void;
}> = ({ article, via, records, checked, onCheck, onPick }) => {
  const current = records.origins.find((o) => o.article_id === article.id)?.source_id;
  return (
    <li className="prisma-origin">
      <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Selecionar ${article.title}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0, flex: 1 }}>
        <span style={{ overflowWrap: 'anywhere' }}>{article.title}</span>
        <span className="review-muted">{via}</span>
        <label style={LABEL}>
          Origem
          <select
            style={FIELD}
            value={current ?? ''}
            onChange={(e) => onPick(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Origem não informada</option>
            <SourceOptions records={records} />
          </select>
        </label>
      </div>
    </li>
  );
};

const BulkOrigin: React.FC<{ records: PrismaRecords; count: number; onApply: (sourceId: number) => void }> = ({
  records,
  count,
  onApply,
}) => {
  const [sourceId, setSourceId] = useState('');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'flex-end' }}>
      <label style={{ ...LABEL, flex: '1 1 10rem', minWidth: 0 }}>
        Marcar os selecionados ({count}) como
        <select style={FIELD} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Escolha a fonte</option>
          <SourceOptions records={records} />
        </select>
      </label>
      <button
        type="button"
        className="review-small"
        disabled={!count || !sourceId}
        onClick={() => onApply(Number(sourceId))}
      >
        Aplicar
      </button>
    </div>
  );
};

/**
 * The articles that came from outside the searches, each with a picker of where it came from, and a bulk
 * picker for the selected ones. The PRISMA "other methods" box counts them by the method of that source.
 *
 * @example <ArticleOrigins articles={outside} viaOf={(a) => 'Adição manual'} records={records} actions={actions} />
 */
export const ArticleOrigins: React.FC<{
  articles: Article[];
  /** How the article entered the project, as the history logged it. */
  viaOf: (article: Article) => string;
  records: PrismaRecords;
  actions: OriginActions;
}> = ({ articles, viaOf, records, actions }) => {
  const [checked, setChecked] = useState<number[]>([]);
  const toggle = (id: number) => setChecked(checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id]);
  const applyBulk = async (sourceId: number) => {
    await actions.setOrigins(checked, sourceId);
    setChecked([]);
  };
  return (
    <section className="prisma-editor" aria-label="Origem dos artigos de fora das buscas">
      <strong>Artigos de fora das buscas ({articles.length})</strong>
      <p className="review-muted" style={{ margin: 0 }}>
        Entraram por adição manual, importação de PDFs ou importação de outro projeto. Diga de onde cada um veio; o app
        conta sozinho por método.
      </p>
      <ul className="prisma-list">
        {articles.map((a) => (
          <OriginRow
            key={a.id}
            article={a}
            via={viaOf(a)}
            records={records}
            checked={checked.includes(a.id)}
            onCheck={() => toggle(a.id)}
            onPick={(sourceId) => void actions.setOrigins([a.id], sourceId)}
          />
        ))}
      </ul>
      <BulkOrigin records={records} count={checked.length} onApply={(id) => void applyBulk(id)} />
    </section>
  );
};

const EMPTY: PrismaSourceInput = { name: '', method: 'citations', url: '', consulted_on: '' };

const SourceForm: React.FC<{ onSave: (input: PrismaSourceInput) => Promise<void>; onCancel: () => void }> = ({
  onSave,
  onCancel,
}) => {
  const [draft, setDraft] = useState<PrismaSourceInput>(EMPTY);
  const set = (field: keyof PrismaSourceInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [field]: e.target.value });
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.name.trim()) void onSave(draft);
      }}
    >
      <label style={LABEL}>
        Nome
        <input style={FIELD} value={draft.name} onChange={set('name')} placeholder="Ex.: Google Scholar" />
      </label>
      <label style={LABEL}>
        Método
        <select style={FIELD} value={draft.method} onChange={set('method')}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_NAMES[m]}
            </option>
          ))}
        </select>
      </label>
      <label style={LABEL}>
        Endereço (opcional)
        <input style={FIELD} type="url" value={draft.url ?? ''} onChange={set('url')} placeholder="https://" />
      </label>
      <label style={LABEL}>
        Consultada em
        <input style={FIELD} type="date" value={draft.consulted_on ?? ''} onChange={set('consulted_on')} />
      </label>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button type="submit" className="review-small">
          Salvar fonte
        </button>
        <button type="button" className="review-small" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

/**
 * The sources of the project (name, method, address, day consulted, how many articles came from each) and the
 * form for a new one. PRISMA item 6 asks for each source and when it was consulted.
 *
 * @example <ProjectSources records={records} onSave={actions.saveSource} />
 */
export const ProjectSources: React.FC<{ records: PrismaRecords; onSave: OriginActions['saveSource'] }> = ({
  records,
  onSave,
}) => {
  const [adding, setAdding] = useState(false);
  const count = (id: number) => records.origins.filter((o) => o.source_id === id).length;
  return (
    <section className="prisma-editor" aria-label="Fontes do projeto">
      <strong>Fontes do projeto</strong>
      <ul className="prisma-list">
        {records.sources.map((s) => (
          <li key={s.id} className="prisma-item">
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowWrap: 'anywhere' }}>
              <span>{s.name}</span>
              <span className="review-muted">
                {METHOD_NAMES[s.method]}
                {s.consulted_on ? ` · consultada em ${brazilianDate(s.consulted_on)}` : ''}
                {s.url ? ` · ${s.url}` : ''}
              </span>
            </span>
            <span className="review-muted">{count(s.id)}</span>
          </li>
        ))}
      </ul>
      {adding ? (
        <SourceForm
          onCancel={() => setAdding(false)}
          onSave={async (input) => {
            await onSave(input);
            setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="review-small"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setAdding(true)}
        >
          + Nova fonte
        </button>
      )}
    </section>
  );
};
