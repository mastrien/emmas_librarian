import type { PendingPhoneChange } from '../../types/remoteAccess';

const ENTITY_NAMES: { [entity: string]: string } = {
  projects: 'Projeto',
  articles: 'Artigo',
  annotations: 'Anotação',
  highlights: 'Marcação',
  project_diary: 'Página do diário',
  project_documents: 'Link de acesso rápido',
};

const KIND_NAMES: { [kind in PendingPhoneChange['kind']]: string } = {
  insert: 'Adicionar',
  update: 'Alterar',
  delete: 'Excluir',
};

/** The text a row is best known by, for the review list: its title, name or first words. */
function headline(fields: PendingPhoneChange['fields'] | PendingPhoneChange['current']): string {
  if (!fields) return '';
  const text = [
    fields.title,
    fields.name,
    fields.content_text,
    fields.content_markdown,
    fields.content,
    fields.entry_date,
  ].find((value) => typeof value === 'string' && value.trim() !== '');
  const shown = String(text ?? '');
  return shown.length > 140 ? `${shown.slice(0, 140)}…` : shown;
}

export interface PhoneChangeText {
  kind: string;
  entity: string;
  /** What the phone sent; for a delete, the row it wants to remove. */
  detail: string;
  /** For an alteration, what the row says now on this computer. */
  before: string | null;
  destructive: boolean;
}

/**
 * The words the review list shows for a change.
 *
 * @example describePhoneChange({ kind: 'update', entity: 'projects', fields: { name: 'Novo' }, current: { name: 'Antigo' }, … })
 */
export function describePhoneChange(change: PendingPhoneChange): PhoneChangeText {
  const entity = ENTITY_NAMES[change.entity] ?? change.entity;
  const sent = headline(change.fields);
  const now = headline(change.current);
  return {
    kind: KIND_NAMES[change.kind],
    entity,
    detail: change.kind === 'delete' ? now || 'registro sem texto' : sent || 'sem texto',
    before: change.kind === 'update' && now && now !== sent ? now : null,
    destructive: change.kind === 'delete',
  };
}
