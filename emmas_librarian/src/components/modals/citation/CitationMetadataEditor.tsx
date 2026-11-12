import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { CitationFields } from '../../../utils/cslMetadata';
import { CitationMetadataFields } from '../../common/citation/CitationMetadataFields';
import { Button } from '../../common/Button';
import { ModalFooter } from '../../common/ModalFooter';
import './citation.css';

interface CitationMetadataEditorProps {
  fields: CitationFields;
  saving: boolean;
  onChange: (field: keyof CitationFields, value: string) => void;
  onReset: () => void;
  onBack: () => void;
  onSave: () => void;
}

/**
 * The citation window's second view: the metadata the citation is built from. Edits show in the citation at once; they
 * reach the article only with "Salvar".
 *
 * @example <CitationMetadataEditor fields={fields} saving={false} onChange={setField} onReset={reset} onBack={back} onSave={save} />
 */
export const CitationMetadataEditor: React.FC<CitationMetadataEditorProps> = (props) => (
  <>
    <div className="citation-edit">
      <CitationMetadataFields fields={props.fields} onChange={props.onChange} />
    </div>
    <ModalFooter
      leading={
        <Button variant="ghost" onClick={props.onReset}>
          <RotateCcw size={14} aria-hidden="true" /> Restaurar
        </Button>
      }
    >
      <Button onClick={props.onBack}>Voltar à citação</Button>
      <Button variant="primary" onClick={props.onSave} disabled={props.saving}>
        {props.saving ? 'Salvando...' : 'Salvar'}
      </Button>
    </ModalFooter>
  </>
);
