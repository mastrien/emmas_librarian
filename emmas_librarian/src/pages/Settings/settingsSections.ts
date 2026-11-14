// The sections of the settings (board 170): each is a screen of its own, reached from the list on the left.

export type SettingsSection = 'appearance' | 'keys' | 'ai' | 'backup' | 'mobile' | 'updates' | 'trash';

export interface SettingsSectionInfo {
  id: SettingsSection;
  label: string;
  /** The line under the title of the section's screen. */
  subtitle: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSectionInfo[] = [
  { id: 'appearance', label: 'Aparência', subtitle: 'Modo claro ou escuro e o tom das cores' },
  { id: 'keys', label: 'Chaves das bases', subtitle: 'O que as buscas pedem para consultar cada base' },
  { id: 'ai', label: 'Inteligência artificial', subtitle: 'Quem responde cada tarefa e com quais chaves' },
  { id: 'backup', label: 'Backup e segurança', subtitle: 'Cópias da biblioteca e como restaurá-las' },
  // Not on the canvas of board 170: added with the LAN server (#32).
  { id: 'mobile', label: 'Acesso pelo celular', subtitle: 'Ler a biblioteca no celular pela rede local' },
  { id: 'updates', label: 'Atualizações', subtitle: 'A versão instalada e as novas' },
  { id: 'trash', label: 'Lixeira', subtitle: 'O que foi apagado e ainda pode voltar' },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSection = 'appearance';

/**
 * Whether a path segment names a section.
 *
 * @example isSettingsSection('ai') // true; isSettingsSection('x') // false
 */
export function isSettingsSection(segment: string | undefined): segment is SettingsSection {
  return SETTINGS_SECTIONS.some((section) => section.id === segment);
}

/**
 * The section a route shows: the one named, or the first when the path names none (or an unknown one).
 *
 * @example sectionOf(undefined) // 'appearance'
 */
export function sectionOf(segment: string | undefined): SettingsSection {
  return isSettingsSection(segment) ? segment : DEFAULT_SETTINGS_SECTION;
}

/**
 * "2/4": how many of the bases' keys are filled in, for the list on the left.
 *
 * @example keysCount(['abc', '', 'x', '  ']) // '2/4'
 */
export function keysCount(keys: string[]): string {
  return `${keys.filter((key) => key.trim() !== '').length}/${keys.length}`;
}
