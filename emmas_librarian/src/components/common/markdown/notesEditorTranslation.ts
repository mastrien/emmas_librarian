// MDXEditor speaks English by default ("Block type", "Bold"); the app is in Portuguese. Only the keys the shared
// formatting bar and the link dialog use are here: anything else falls back to the library's own text.
const PT_BR: Record<string, string> = {
  'toolbar.bold': 'Negrito',
  'toolbar.removeBold': 'Tirar negrito',
  'toolbar.italic': 'Itálico',
  'toolbar.removeItalic': 'Tirar itálico',
  'toolbar.blockTypeSelect.placeholder': 'Tipo de texto',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': 'Escolher o tipo de texto',
  'toolbar.blockTypes.paragraph': 'Parágrafo',
  'toolbar.blockTypes.heading': 'Título {{level}}',
  'toolbar.blockTypes.quote': 'Citação',
  'toolbar.bulletedList': 'Lista',
  'toolbar.checkList': 'Lista de tarefas',
  'toolbar.numberedList': 'Lista numerada',
  'toolbar.link': 'Inserir link',
  'toolbar.thematicBreak': 'Inserir linha divisória',
  'createLink.url': 'Endereço',
  'createLink.urlPlaceholder': 'Cole ou digite um endereço',
  'createLink.text': 'Texto do link',
  'createLink.textTooltip': 'O texto que aparece no lugar do endereço',
  'createLink.title': 'Título do link',
  'createLink.titleTooltip': 'Aparece ao passar o mouse',
  'createLink.saveTooltip': 'Salvar o link',
  'createLink.cancelTooltip': 'Cancelar',
  'dialogControls.save': 'Salvar',
  'dialogControls.cancel': 'Cancelar',
  'linkPreview.edit': 'Editar o link',
  'linkPreview.remove': 'Remover o link',
  'linkPreview.copyToClipboard': 'Copiar',
  'linkPreview.copied': 'Copiado!',
};

/**
 * MDXEditor's `translation` prop for Portuguese; "{{name}}" placeholders are filled from the interpolations.
 *
 * @example notesEditorTranslation('toolbar.blockTypes.heading', 'Heading {{level}}', { level: 2 }) // 'Título 2'
 */
export function notesEditorTranslation(
  key: string,
  defaultValue: string,
  interpolations: Record<string, unknown> = {},
): string {
  const text = PT_BR[key] ?? defaultValue;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(interpolations[name] ?? ''));
}
