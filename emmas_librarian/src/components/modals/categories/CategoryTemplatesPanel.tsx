import React, { useState } from 'react';
import { Download, LayoutTemplate, Upload } from 'lucide-react';
import type { ProjectCategory } from '../../../types';
import {
  CATEGORY_TEMPLATES,
  categorySetJson,
  describeCategorySetResult,
  type CategorySetEntry,
  type CategorySetResult,
} from '../../../utils/categoryTemplates';
import { describeError } from '../../../utils/describeError';
import { CategoriesNotice, type CategoriesNoticeContent } from './CategoriesNotice';

export interface CategoryTemplatesPanelProps {
  categories: ProjectCategory[];
  applySet: (entries: CategorySetEntry[]) => Promise<CategorySetResult>;
  readSetFile: () => Promise<CategorySetEntry[] | null>;
  saveFile: (content: string, defaultPath: string) => Promise<boolean>;
  /** Called after categories were added, to reload the list. */
  onApplied: () => Promise<void>;
}

/** A set waiting for the person's answer before it is added to a project that already has categories. */
interface PendingSet {
  entries: CategorySetEntry[];
  source: string;
}

/**
 * The question before adding a set to a project that already has categories; nothing is ever deleted (#46).
 *
 * @example appendQuestion(3, 'PICO') // 'O projeto já tem 3 categoria(s). Acrescentar as de "PICO"? …'
 */
export const appendQuestion = (existing: number, source: string): string =>
  `O projeto já tem ${existing} categoria(s). Acrescentar as de "${source}"? Nada é apagado; nomes que já existem são mantidos como estão.`;

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
  padding: '1rem',
  marginBottom: '1.5rem',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
};

const buttonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem' };

// The question, the result and the failures of the panel, shown in the modal instead of native dialogs.
function usePanelNotice() {
  const [notice, setNotice] = useState<CategoriesNoticeContent | null>(null);
  const [pending, setPending] = useState<PendingSet | null>(null);
  const ask = (set: PendingSet, existing: number) => {
    setPending(set);
    setNotice({ text: appendQuestion(existing, set.source), tone: 'ask', confirmLabel: 'Acrescentar' });
  };
  const clear = () => {
    setPending(null);
    setNotice(null);
  };
  return { notice, pending, ask, clear, say: setNotice };
}

const TemplatePicker: React.FC<{ value: string; onChange: (id: string) => void }> = ({ value, onChange }) => (
  <select
    className="input-field"
    aria-label="Modelo de categorias"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{ flex: 1, minWidth: '12rem' }}
  >
    {CATEGORY_TEMPLATES.map((t) => (
      <option key={t.id} value={t.id}>
        {t.label}
      </option>
    ))}
  </select>
);

/**
 * Ready-made category sets (PICO, study characteristics, generic quality) and the user's own sets as JSON, in the
 * project categories modal. Everything created stays editable. Results and the question before adding to a
 * project with categories show inside the panel (validation of epic #44: no native dialogs).
 *
 * Usage:
 *   <CategoryTemplatesPanel categories={categories} applySet={...} readSetFile={...} saveFile={...} onApplied={reload} />
 */
export const CategoryTemplatesPanel: React.FC<CategoryTemplatesPanelProps> = (props) => {
  const { categories, applySet, readSetFile, saveFile, onApplied } = props;
  const [templateId, setTemplateId] = useState(CATEGORY_TEMPLATES[0].id);
  const [busy, setBusy] = useState(false);
  const panelNotice = usePanelNotice();
  const template = CATEGORY_TEMPLATES.find((t) => t.id === templateId) ?? CATEGORY_TEMPLATES[0];

  const run = async (work: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      panelNotice.say({ text: `${failure}: ${describeError(err)}`, tone: 'failed' });
    } finally {
      setBusy(false);
    }
  };

  const add = async ({ entries }: PendingSet) => {
    panelNotice.clear();
    panelNotice.say({ text: describeCategorySetResult(await applySet(entries)), tone: 'done' });
    await onApplied();
  };

  const apply = async (set: PendingSet) => {
    if (categories.length > 0) return panelNotice.ask(set, categories.length);
    await add(set);
  };

  const importSet = async () => {
    const entries = await readSetFile();
    if (entries) await apply({ entries, source: 'arquivo importado' });
  };

  const exportSet = async () => {
    if (await saveFile(categorySetJson(categories), 'categorias.json')) {
      panelNotice.say({ text: 'Categorias exportadas.', tone: 'done' });
    }
  };

  const { notice, pending } = panelNotice;
  return (
    <section aria-label="Modelos de categorias" style={panelStyle}>
      <h3 className="categories-section-title">Começar de um modelo</h3>
      {notice && (
        <CategoriesNotice
          notice={notice}
          onDismiss={panelNotice.clear}
          onConfirm={() => pending && run(() => add(pending), 'Não foi possível acrescentar as categorias')}
        />
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <TemplatePicker value={templateId} onChange={setTemplateId} />
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() =>
            run(() => apply({ entries: template.categories, source: template.label }), 'Não foi possível usar o modelo')
          }
          style={buttonStyle}
        >
          <LayoutTemplate size={16} /> Usar modelo
        </button>
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{template.description}</p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-secondary categories-small-button"
          disabled={busy}
          onClick={() => run(importSet, 'Não foi possível importar as categorias')}
          style={buttonStyle}
        >
          <Upload size={14} /> Importar JSON
        </button>
        <button
          type="button"
          className="btn-secondary categories-small-button"
          disabled={busy || categories.length === 0}
          onClick={() => run(exportSet, 'Não foi possível exportar as categorias')}
          style={buttonStyle}
        >
          <Download size={14} /> Exportar JSON
        </button>
      </div>
    </section>
  );
};
