import { useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import {
  citationFieldsToMetadata,
  pickCitationFields,
  tryCitationFieldsFromCsl,
  type CitableArticle,
  type CitationFields,
} from '../../../utils/cslMetadata';

export interface EditingCitation {
  articleId: number;
  cslJson: unknown;
  fields: CitationFields;
}

interface MassCitationEditorOptions {
  /** The fields as they were when the modal opened; "Resetar" falls back to these without CSL-JSON. */
  originalFields: (articleId: number) => CitationFields | undefined;
  onSaved: (articleId: number, fields: CitationFields) => void;
}

/**
 * Edit state for one reference of the mass citation list: open, change, reset to CSL-JSON, save.
 *
 * Usage:
 *   const editor = useMassCitationEditor({ originalFields, onSaved });
 *   editor.start(article); editor.setField('title', 'Novo'); await editor.save();
 */
export function useMassCitationEditor({ originalFields, onSaved }: MassCitationEditorOptions) {
  const projectService = useProjectService();
  const [editing, setEditing] = useState<EditingCitation | null>(null);
  const [saving, setSaving] = useState(false);

  const start = (article: CitableArticle) =>
    setEditing({ articleId: article.id, cslJson: article.csl_json, fields: pickCitationFields(article) });

  const setField = (field: keyof CitationFields, value: string) =>
    setEditing((prev) => prev && { ...prev, fields: { ...prev.fields, [field]: value } });

  const reset = () => {
    if (!editing) return;
    const restored = tryCitationFieldsFromCsl(editing.cslJson) ?? originalFields(editing.articleId);
    if (restored) setEditing({ ...editing, fields: restored });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await projectService.updateArticleMetadata(editing.articleId, citationFieldsToMetadata(editing.fields));
      onSaved(editing.articleId, editing.fields);
      setEditing(null);
    } catch (err) {
      console.error('Erro ao salvar metadados em lote:', err);
      alert('Erro ao salvar metadados.');
    } finally {
      setSaving(false);
    }
  };

  return { editing, saving, start, close: () => setEditing(null), setField, reset, save };
}
