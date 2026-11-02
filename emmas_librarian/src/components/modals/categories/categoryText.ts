// The names the categories modal shows for each kind of category.
const TYPE_NAMES: Record<string, string> = {
  text: 'Texto',
  boolean: 'Sim/Não',
  enum: 'Lista de Opções',
  multiselect: 'Múltipla Escolha',
};

/** The category kinds in the order the type pickers list them. */
export const CATEGORY_TYPE_CHOICES = Object.entries(TYPE_NAMES).map(([value, label]) => ({ value, label }));

/** Whether a category kind has options to pick from. */
export const categoryHasOptions = (type: string): boolean => type === 'enum' || type === 'multiselect';

/**
 * The name a category kind is shown with; an unknown kind reads as text, as the app stores it.
 *
 * @example categoryTypeName('enum') // 'Lista de Opções'
 */
export function categoryTypeName(type: string): string {
  return TYPE_NAMES[type] ?? TYPE_NAMES.text;
}

/**
 * The first options of a list category, for its row in the modal (validation of epic #44: the row said only
 * "Tipo: Lista de Opções").
 *
 * @example optionsSummary(['Coorte', 'Caso-controle', 'Transversal', 'Outro']) // '4 opções: Coorte, Caso-controle, Transversal, …'
 */
export function optionsSummary(names: string[], shown = 3): string {
  if (names.length === 0) return '';
  const count = names.length === 1 ? '1 opção' : `${names.length} opções`;
  const more = names.length > shown ? ', …' : '';
  return `${count}: ${names.slice(0, shown).join(', ')}${more}`;
}
