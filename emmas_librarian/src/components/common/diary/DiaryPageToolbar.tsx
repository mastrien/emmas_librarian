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
  /** The page changed somewhere else ("conflict": nothing more is written from here) or a save failed. */
  problem: 'conflict' | 'failed' | null;
  /** Reads the page again, in the conflict. */
  onReload: () => void;
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

const SaveStatus: React.FC<
  Pick<DiaryPageToolbarProps, 'saving' | 'hasChanges' | 'savedAt' | 'problem' | 'onReload'>
> = (props) => {
  if (props.problem === 'conflict') {
    return (
      <span className="diary-save diary-save--problem" role="alert">
        Não salvo: a página mudou em outro lugar.{' '}
        <button type="button" className="diary-save__reload" onClick={props.onReload}>
          Recarregar
        </button>
      </span>
    );
  }
  if (props.problem === 'failed') {
    return (
      <span className="diary-save diary-save--problem" role="alert">
        Não foi possível salvar. Vou tentar de novo na próxima alteração.
      </span>
    );
  }
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
 *   <DiaryPageToolbar mode={mode} onModeChange={setMode} saving={false} hasChanges={false} savedAt="22:10" problem={null} … />
 */
export const DiaryPageToolbar: React.FC<DiaryPageToolbarProps> = (props) => (
  <div className="diary-toolbar">
    <SegmentedControl label="Modo da página" options={MODES} value={props.mode} onChange={props.onModeChange} />
    <SaveStatus
      saving={props.saving}
      hasChanges={props.hasChanges}
      savedAt={props.savedAt}
      problem={props.problem}
      onReload={props.onReload}
    />
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
