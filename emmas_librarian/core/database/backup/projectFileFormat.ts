/**
 * Version of the `project.json` inside a .emmapcarc (#30). Readers other than this app (the mobile
 * viewer of #33) open files written by several desktop versions, so the file says which shape it has.
 *
 * Version 1 is every file written before the field existed. Raise the number only when an older
 * reader would misread the file; a new optional list does not need a new version.
 */
export const PROJECT_FORMAT_VERSION = 2;

/** The format of files that carry no `formatVersion`: everything exported up to app 1.4.0. */
export const LEGACY_PROJECT_FORMAT_VERSION = 1;

const isVersionNumber = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1;

/**
 * Reads the format version of a parsed `project.json`, taking a missing field as version 1.
 *
 * Usage:
 *   projectFormatVersionOf({ project: { name: 'Tese' } }); // 1
 *   projectFormatVersionOf({ formatVersion: 2 }); // 2
 */
export function projectFormatVersionOf(projectJson: { formatVersion?: unknown }): number {
  const declared = projectJson.formatVersion;
  if (declared === undefined || declared === null) return LEGACY_PROJECT_FORMAT_VERSION;
  if (isVersionNumber(declared)) return declared;
  throw new Error(
    `Arquivo de projeto inválido: formatVersion é ${JSON.stringify(declared)}, esperado um inteiro a partir de 1`,
  );
}

/**
 * Refuses a `project.json` written in a format newer than this app reads, instead of importing half of it.
 *
 * Usage:
 *   assertReadableProjectFormat(JSON.parse(text));
 */
export function assertReadableProjectFormat(projectJson: { formatVersion?: unknown }): void {
  const version = projectFormatVersionOf(projectJson);
  if (version <= PROJECT_FORMAT_VERSION) return;
  throw new Error(
    `Arquivo de projeto no formato ${version}, mas esta versão do app lê até o formato ${PROJECT_FORMAT_VERSION}. Atualize o Emma's Librarian para importar este arquivo.`,
  );
}
