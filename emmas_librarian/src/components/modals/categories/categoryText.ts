// The names the categories modal shows for each kind of category.
const TYPE_NAMES: Record<string, string> = {
  text: 'Texto',
  boolean: 'Sim ou não',
  enum: 'Lista',
  multiselect: 'Múltipla escolha',
};

/** The category kinds in the order the type pickers list them. */
export const CATEGORY_TYPE_CHOICES = Object.entries(TYPE_NAMES).map(([value, label]) => ({ value, label }));

/** Whether a category kind has options to pick from. */
export const categoryHasOptions = (type: string): boolean => type === 'enum' || type === 'multiselect';

/**
 * The name a category kind is shown with; an unknown kind reads as text, as the app stores it.
 *
 * @example categoryTypeName('enum') // 'Lista'
 */
export function categoryTypeName(type: string): string {
  return TYPE_NAMES[type] ?? TYPE_NAMES.text;
}
