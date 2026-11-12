import React from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { fileNameFromPath } from '../../../utils/formatters';
import { Button } from '../../common/Button';
import { ModalFooter } from '../../common/ModalFooter';
import { TextField } from '../../common/fields';
import type { QuickAccessDraft } from './useQuickAccessForm';
import './quickAccess.css';

interface QuickAccessFormProps {
  draft: QuickAccessDraft;
  isEditing: boolean;
  submitting: boolean;
  categories: string[];
  /** The window was opened by "Novo grupo": the group is the first thing to fill in. */
  groupFirst: boolean;
  onChange: (changes: Partial<QuickAccessDraft>) => void;
  onSelectFile: () => void;
  onCancelEdit: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * The second view of the quick access window: add or edit a link or a PDF, with the groups already in use offered.
 *
 * Usage:
 *   <QuickAccessForm draft={form.draft} isEditing={false} submitting={false} categories={[]} groupFirst={false}
 *     onChange={form.update} onSelectFile={form.selectFile} onCancelEdit={back} onSubmit={form.submit} />
 */
export const QuickAccessForm: React.FC<QuickAccessFormProps> = (props) => {
  const { draft, isEditing, submitting, onCancelEdit, onSubmit } = props;
  return (
    <form onSubmit={onSubmit}>
      <div className="quick-access-fields">
        {props.groupFirst && <GroupField {...props} autoFocus />}
        <TextField
          required
          autoFocus={!props.groupFirst}
          label="Nome do link ou documento *"
          placeholder="Ex: Trello do Projeto, Edital CAPES"
          value={draft.title}
          onChange={(e) => props.onChange({ title: e.target.value })}
        />
        {!props.groupFirst && <GroupField {...props} />}
        <SourceFields {...props} />
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onCancelEdit}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting || (!draft.url && !draft.filePath)}>
          {submitting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {isEditing ? 'Salvar alterações' : 'Adicionar'}
        </Button>
      </ModalFooter>
    </form>
  );
};

const GroupField: React.FC<QuickAccessFormProps & { autoFocus?: boolean }> = ({
  draft,
  categories,
  onChange,
  autoFocus,
}) => (
  <>
    <TextField
      autoFocus={autoFocus}
      list="quick-access-categories"
      label={
        <>
          Grupo <span className="modal-optional">(opcional)</span>
        </>
      }
      placeholder="Ex: Reuniões, Modelos"
      value={draft.category}
      onChange={(e) => onChange({ category: e.target.value })}
    />
    <datalist id="quick-access-categories">
      {categories.map((cat) => (
        <option key={cat} value={cat} />
      ))}
    </datalist>
  </>
);

// One source only: while a PDF is chosen the link is locked, and the other way round.
const SourceFields: React.FC<QuickAccessFormProps> = ({ draft, onChange, onSelectFile }) => {
  const hasFile = !!draft.filePath;
  const hasUrl = !!draft.url.trim();
  return (
    <>
      <TextField
        type="url"
        label="Link"
        hint="Escolha apenas um: link ou arquivo PDF."
        placeholder="https://"
        value={draft.url}
        disabled={hasFile}
        onChange={(e) => onChange({ url: e.target.value })}
      />
      <div className="quick-access-file">
        <Button onClick={onSelectFile} disabled={hasUrl}>
          <Upload size={15} aria-hidden="true" /> {hasFile ? 'Trocar PDF' : 'Anexar PDF'}
        </Button>
        {hasFile && (
          <>
            <span className="quick-access-row__where" title={draft.filePath}>
              {fileNameFromPath(draft.filePath!)}
            </span>
            <Button variant="ghost" size="sm" title="Remover PDF" onClick={() => onChange({ filePath: undefined })}>
              <X size={14} aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </>
  );
};
