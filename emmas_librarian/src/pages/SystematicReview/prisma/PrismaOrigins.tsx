import React, { useState } from 'react';
import type { Article, PrismaRecords, PrismaSource, PrismaSourceInput, PrismaSourceMethod } from '../../../types';
import { brazilianDate, METHOD_NAMES } from '../../../utils/prismaFlow';
import { PANEL_FIELD, PANEL_LABEL } from './panelFieldStyles';

/** What the origin editor can change; each call answers the records as they now are. */
export interface OriginActions {
  saveSource: (input: PrismaSourceInput) => Promise<void>;
  setOrigins: (articleIds: number[], sourceId: number | null) => Promise<void>;
}

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
        <label style={PANEL_LABEL}>
          Origem
          <select
            className="input-field input-compact"
            style={PANEL_FIELD}
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
      <label style={{ ...PANEL_LABEL, flex: '1 1 10rem', minWidth: 0 }}>
        Marcar os selecionados ({count}) como
        <select
          className="input-field input-compact"
          style={PANEL_FIELD}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
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

/**
 * The form's starting values for a source being edited; its id makes the save an update.
 *
 * @example draftOf({ id: 2, project_id: 1, name: 'Scholar', method: 'websites', url: null, consulted_on: null })
 *   // { id: 2, name: 'Scholar', method: 'websites', url: '', consulted_on: '' }
 */
export function draftOf(source: PrismaSource): PrismaSourceInput {
  const { id, name, method, url, consulted_on } = source;
  return { id, name, method, url: url ?? '', consulted_on: consulted_on ?? '' };
}

const SourceForm: React.FC<{
  initial: PrismaSourceInput;
  onSave: (input: PrismaSourceInput) => Promise<void>;
  onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const [draft, setDraft] = useState<PrismaSourceInput>(initial);
  const set = (field: keyof PrismaSourceInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [field]: e.target.value });
  return (
    <form
      aria-label={initial.id === undefined ? 'Nova fonte' : `Editar fonte ${initial.name}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.name.trim()) void onSave(draft);
      }}
    >
      <label style={PANEL_LABEL}>
        Nome
        <input
          className="input-field input-compact"
          style={PANEL_FIELD}
          value={draft.name}
          onChange={set('name')}
          placeholder="Ex.: Google Scholar"
        />
      </label>
      <label style={PANEL_LABEL}>
        Método
        <select className="input-field input-compact" style={PANEL_FIELD} value={draft.method} onChange={set('method')}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_NAMES[m]}
            </option>
          ))}
        </select>
      </label>
      <label style={PANEL_LABEL}>
        Endereço (opcional)
        <input
          className="input-field input-compact"
          style={PANEL_FIELD}
          type="url"
          value={draft.url ?? ''}
          onChange={set('url')}
          placeholder="https://"
        />
      </label>
      <label style={PANEL_LABEL}>
        Consultada em
        <input
          className="input-field input-compact"
          style={PANEL_FIELD}
          type="date"
          value={draft.consulted_on ?? ''}
          onChange={set('consulted_on')}
        />
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

const SourceItem: React.FC<{ source: PrismaSource; count: number; onEdit: () => void }> = ({
  source,
  count,
  onEdit,
}) => (
  <li className="prisma-item">
    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowWrap: 'anywhere' }}>
      <span>{source.name}</span>
      <span className="review-muted">
        {METHOD_NAMES[source.method]}
        {source.consulted_on ? ` · consultada em ${brazilianDate(source.consulted_on)}` : ''}
        {source.url ? ` · ${source.url}` : ''}
      </span>
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 'none' }}>
      <span className="review-muted">{count}</span>
      <button type="button" className="review-small" aria-label={`Editar fonte ${source.name}`} onClick={onEdit}>
        Editar
      </button>
    </span>
  </li>
);

/**
 * The sources of the project (name, method, address, day consulted, how many articles came from each), the form
 * for a new one and, in place of a source, the same form to edit it (validation of epic #44: a source could only
 * be created). PRISMA item 6 asks for each source and when it was consulted. One form is open at a time.
 *
 * @example <ProjectSources records={records} onSave={actions.saveSource} />
 */
export const ProjectSources: React.FC<{ records: PrismaRecords; onSave: OriginActions['saveSource'] }> = ({
  records,
  onSave,
}) => {
  // 'new' for the form of a new source, a source id while that source is edited.
  const [open, setOpen] = useState<'new' | number | null>(null);
  const count = (id: number) => records.origins.filter((o) => o.source_id === id).length;
  const form = (initial: PrismaSourceInput) => (
    <SourceForm
      initial={initial}
      onCancel={() => setOpen(null)}
      onSave={async (input) => {
        await onSave(input);
        setOpen(null);
      }}
    />
  );
  return (
    <section className="prisma-editor" aria-label="Fontes do projeto">
      <strong>Fontes do projeto</strong>
      <ul className="prisma-list">
        {records.sources.map((s) =>
          open === s.id ? (
            <li key={s.id}>{form(draftOf(s))}</li>
          ) : (
            <SourceItem key={s.id} source={s} count={count(s.id)} onEdit={() => setOpen(s.id)} />
          ),
        )}
      </ul>
      {open === 'new' ? (
        form(EMPTY)
      ) : (
        <button
          type="button"
          className="review-small"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setOpen('new')}
        >
          + Nova fonte
        </button>
      )}
    </section>
  );
};
