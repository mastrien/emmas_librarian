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

export interface CategoryTemplatesPanelProps {
  categories: ProjectCategory[];
  applySet: (entries: CategorySetEntry[]) => Promise<CategorySetResult>;
  readSetFile: () => Promise<CategorySetEntry[] | null>;
  saveFile: (content: string, defaultPath: string) => Promise<boolean>;
  /** Called after categories were added, to reload the list. */
  onApplied: () => Promise<void>;
}

// A project that already has categories gets a question first; nothing is ever deleted (#46).
function confirmAppend(existing: number, source: string): boolean {
  if (existing === 0) return true;
  return window.confirm(
    `O projeto já tem ${existing} categoria(s). Acrescentar as de "${source}"? Nada é apagado; nomes que já existem são mantidos como estão.`,
  );
}

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

/**
 * Ready-made category sets (PICO, study characteristics, generic quality) and the user's own sets as JSON, in the
 * project categories modal. Everything created stays editable.
 *
 * Usage:
 *   <CategoryTemplatesPanel categories={categories} applySet={...} readSetFile={...} saveFile={...} onApplied={reload} />
 */
export const CategoryTemplatesPanel: React.FC<CategoryTemplatesPanelProps> = (props) => {
  const { categories, applySet, readSetFile, saveFile, onApplied } = props;
  const [templateId, setTemplateId] = useState(CATEGORY_TEMPLATES[0].id);
  const [busy, setBusy] = useState(false);
  const template = CATEGORY_TEMPLATES.find((t) => t.id === templateId) ?? CATEGORY_TEMPLATES[0];

  const run = async (work: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      alert(`${failure}: ${describeError(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const apply = async (entries: CategorySetEntry[], source: string) => {
    if (!confirmAppend(categories.length, source)) return;
    alert(describeCategorySetResult(await applySet(entries)));
    await onApplied();
  };

  const importSet = async () => {
    const entries = await readSetFile();
    if (entries) await apply(entries, 'arquivo importado');
  };

  const exportSet = async () => {
    if (await saveFile(categorySetJson(categories), 'categorias.json')) alert('Categorias exportadas.');
  };

  return (
    <section aria-label="Modelos de categorias" style={panelStyle}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <select
          className="input-field"
          aria-label="Modelo de categorias"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          style={{ flex: 1, minWidth: '12rem' }}
        >
          {CATEGORY_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => run(() => apply(template.categories, template.label), 'Não foi possível usar o modelo')}
          style={buttonStyle}
        >
          <LayoutTemplate size={16} /> Usar modelo
        </button>
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{template.description}</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => run(importSet, 'Não foi possível importar as categorias')}
          style={buttonStyle}
        >
          <Upload size={16} /> Importar categorias (JSON)
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || categories.length === 0}
          onClick={() => run(exportSet, 'Não foi possível exportar as categorias')}
          style={buttonStyle}
        >
          <Download size={16} /> Exportar categorias (JSON)
        </button>
      </div>
    </section>
  );
};
