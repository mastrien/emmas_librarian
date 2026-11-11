import React, { useState } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import type { SearchPreview, SearchPreviewItem } from '../../types';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
import { ArticleDetailsModal } from './ArticleDetailsModal';
import { previewItemToArticle } from './searchSummary/previewItemToArticle';
import { saveButtonLabel, searchCounts, type SearchCounts } from './searchSummary/searchCounts';
import { SearchBreakdownList } from './searchSummary/SearchBreakdownList';
import { SearchPreviewList } from './searchSummary/SearchPreviewList';
import './searchSummary/searchSummary.css';

interface SearchSummaryModalProps {
  preview: SearchPreview;
  isSaving: boolean;
  // Shown inside the dialog: the page behind it is covered by the overlay.
  saveError?: string | null;
  /** Running a past search again: what the project already has is known, so the list starts without it (#52). */
  startOnlyNew?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

const StatBox: React.FC<{ label: string; value: number; isNew?: boolean }> = ({ label, value, isNew }) => (
  <div className="search-summary-stat">
    <div className="search-summary-stat-label">{label}</div>
    <div className={`search-summary-stat-value${isNew ? ' search-summary-stat-value--new' : ''}`}>{value}</div>
  </div>
);

// The four numbers read as a subtraction, so the user sees where each found article went.
const SummaryCounts: React.FC<{ counts: SearchCounts }> = ({ counts }) => (
  <div>
    <div role="group" aria-label="Contagem da busca" className="search-summary-counts">
      <StatBox label="Encontrados" value={counts.found} />
      <StatBox label="Repetidos" value={counts.repeated} />
      <StatBox label="Já no projeto" value={counts.alreadyInProject} />
      <StatBox label="Novos" value={counts.added} isNew />
    </div>
    <p className="search-summary-explain">
      Encontrados soma o que cada base devolveu. Repetidos são as cópias do mesmo artigo vindas de mais de uma base
      (mesmo DOI ou mesmo título). Novos são os que entram no projeto ao salvar; os que já estão nele só ganham a base
      nova na lista de origem.
    </p>
  </div>
);

type SummaryActionsProps = Omit<SearchSummaryModalProps, 'preview' | 'saveError'> & { added: number };

const SummaryActions: React.FC<SummaryActionsProps> = ({ isSaving, onSave, onDiscard, added }) => (
  <ModalFooter
    leading={
      <Button variant="ghost" className="search-summary-discard" onClick={onDiscard} disabled={isSaving}>
        <Trash2 size={16} aria-hidden="true" /> Descartar
      </Button>
    }
  >
    <Button variant="primary" onClick={onSave} disabled={isSaving}>
      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} aria-hidden="true" />}{' '}
      {saveButtonLabel(added)}
    </Button>
  </ModalFooter>
);

const OnlyNewToggle: React.FC<{ known: number; checked: boolean; onChange: (checked: boolean) => void }> = (props) => (
  <label className="search-summary-only-new">
    <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    Mostrar só o que não está no projeto ({props.known} já {props.known === 1 ? 'está' : 'estão'})
  </label>
);

/**
 * Results of a search that is not saved yet: counts, per-database outcome and the article list,
 * with the choice to save them into the project or discard them and refine the query.
 *
 * @example <SearchSummaryModal preview={preview} isSaving={false} onSave={save} onDiscard={discard} />
 */
export const SearchSummaryModal: React.FC<SearchSummaryModalProps> = (props) => {
  const { preview, isSaving, saveError, onSave, onDiscard } = props;
  const [onlyNew, setOnlyNew] = useState(props.startOnlyNew ?? false);
  const known = preview.results.filter((r) => r.alreadyInProject).length;
  const shown = onlyNew ? preview.results.filter((r) => !r.alreadyInProject) : preview.results;
  const counts = searchCounts(preview);
  const [detailsItem, setDetailsItem] = useState<SearchPreviewItem | null>(null);

  return (
    <>
      {/* Closing is the same as discarding: nothing half-saved is left behind. Esc does not close, so a key meant
          for the metadata window above, or pressed by accident, never throws the results away. */}
      <Modal
        label="Busca Concluída"
        title="Busca Concluída!"
        description="Nada foi salvo ainda. Revise os resultados e escolha se eles entram no projeto."
        onClose={onDiscard}
        closeLabel="Fechar e descartar"
        busy={isSaving}
        closeOnEscape={false}
        width={680}
      >
        <SummaryCounts counts={counts} />
        <SearchBreakdownList breakdown={preview.breakdown} />
        {known > 0 && <OnlyNewToggle known={known} checked={onlyNew} onChange={setOnlyNew} />}
        <SearchPreviewList results={shown} onOpenDetails={setDetailsItem} />
        {saveError && (
          <p role="alert" className="search-summary-error">
            {saveError}
          </p>
        )}
        <SummaryActions isSaving={isSaving} onSave={onSave} onDiscard={onDiscard} added={counts.added} />
      </Modal>
      {/* After the Modal, so its window lands above the summary. */}
      <ArticleDetailsModal
        isOpen={detailsItem !== null}
        onClose={() => setDetailsItem(null)}
        article={detailsItem ? previewItemToArticle(detailsItem) : null}
        isSearchResult
      />
    </>
  );
};
