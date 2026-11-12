import React from 'react';
import { RotateCcw } from 'lucide-react';
import { CitationMetadataFields } from '../../common/citation/CitationMetadataFields';
import { Button } from '../../common/Button';
import { ModalFooter } from '../../common/ModalFooter';
import type { CitationFields } from '../../../utils/cslMetadata';
import '../citation/citation.css';

interface MassCitationEditPanelProps {
  fields: CitationFields;
  saving: boolean;
  onFieldChange: (field: keyof CitationFields, value: string) => void;
  onCancel: () => void;
  onReset: () => void;
  onSave: () => void;
}

/**
 * Metadata form for the one reference being edited, shown in place of the list.
 *
 * Usage:
 *   <MassCitationEditPanel fields={fields} saving={false} onFieldChange={set} onCancel={close} onReset={reset} onSave={save} />
 */
export const MassCitationEditPanel: React.FC<MassCitationEditPanelProps> = (props) => (
  <>
    <div className="citation-edit">
      <span className="app-modal-group">Editar Metadados da Citação</span>
      <CitationMetadataFields fields={props.fields} onChange={props.onFieldChange} />
    </div>
    <ModalFooter
      leading={
        <Button variant="ghost" onClick={props.onReset}>
          <RotateCcw size={14} aria-hidden="true" /> Resetar
        </Button>
      }
    >
      <Button onClick={props.onCancel}>Cancelar</Button>
      <Button variant="primary" onClick={props.onSave} disabled={props.saving}>
        {props.saving ? 'Salvando...' : 'Salvar Alterações'}
      </Button>
    </ModalFooter>
  </>
);
