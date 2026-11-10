import React from 'react';
import { BookOpen, Check, History, Pencil, Trash2 } from 'lucide-react';
import { SegmentedControl } from '../SegmentedControl';

export type DiaryMode = 'read' | 'edit';

interface DiaryPageToolbarProps {
  mode: DiaryMode;
  onModeChange: (mode: DiaryMode) => void;
  saving: boolean;
  hasChanges: boolean;
  /** When the page was last saved in this visit, "HH:MM"; null before the first save. */
  savedAt: string | null;
  onOpenHistory: () => void;
  onDelete: () => void;
}

const MODES = [
  {
    value: 'read' as const,
    label: (
      <>
        <BookOpen size={14} aria-hidden="true" /> Ler
      </>
    ),
  },
  {
    value: 'edit' as const,
    label: (
      <>
        <Pencil size={14} aria-hidden="true" /> Editar
      </>
    ),
  },
];

const SaveStatus: React.FC<Pick<DiaryPageToolbarProps, 'saving' | 'hasChanges' | 'savedAt'>> = (props) => {
  if (props.saving) return <span className="diary-save">Salvando…</span>;
  if (props.hasChanges) return <span className="diary-save diary-save--pending">Não salvo</span>;
  if (!props.savedAt) return null;
  return (
    <span className="diary-save diary-save--done">
      <Check size={14} aria-hidden="true" /> Salvo às {props.savedAt}
    </span>
  );
};

/**
 * The bar above a diary page (board 155): Ler/Editar (kept from page to page), the save status, the versions and
 * delete. The formatting buttons belong to the editor and show only in Editar.
 *
 * Usage:
 *   <DiaryPageToolbar mode={mode} onModeChange={setMode} saving={false} hasChanges={false} savedAt="22:10" … />
 */
export const DiaryPageToolbar: React.FC<DiaryPageToolbarProps> = (props) => (
  <div className="diary-toolbar">
    <SegmentedControl label="Modo da página" options={MODES} value={props.mode} onChange={props.onModeChange} />
    <SaveStatus saving={props.saving} hasChanges={props.hasChanges} savedAt={props.savedAt} />
    <button
      type="button"
      className="btn-secondary diary-toolbar__button"
      title="Histórico de Versões"
      onClick={props.onOpenHistory}
    >
      <History size={14} /> Versões
    </button>
    <button
      type="button"
      className="row-icon-button diary-toolbar__delete"
      title="Excluir página"
      aria-label="Excluir página"
      onClick={props.onDelete}
    >
      <Trash2 size={15} />
    </button>
  </div>
);
