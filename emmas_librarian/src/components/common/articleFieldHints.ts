// Authors are split on ";" first, then ","; a comma between single words would read "Silva, João" as two people.
export const FULL_NAMES_HINT =
  "Se usar vírgula, use nomes completos (ex: 'João Silva, Maria Souza') para evitar que nomes simples sejam lidos como um único autor.";

export const AUTHORS_SEPARATOR_HINT = `Use ponto e vírgula (;) ou vírgula (,) para separar múltiplos autores. ${FULL_NAMES_HINT}`;
