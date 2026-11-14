import type { CommandFn } from './CommandRegistry';

const LONE_PARAMETER = /^([A-Za-z_$][\w$]*)\s*=>/;

/** The text between the parentheses of a function's parameter list (or the lone parameter of `x => ...`). */
function parameterList(source: string): string {
  const text = source.replace(/^\s*async\s+/, '');
  const lone = LONE_PARAMETER.exec(text);
  if (lone) return lone[1];
  // Past "function name" to the list itself.
  const open = text.indexOf('(');
  let depth = 0;
  for (let at = open; at >= 0 && at < text.length; at += 1) {
    if ('([{'.includes(text[at])) depth += 1;
    if (')]}'.includes(text[at])) depth -= 1;
    if (depth === 0) return text.slice(open + 1, at);
  }
  return '';
}

/** Splits on the commas between parameters, not on the ones inside a destructuring pattern or a default value. */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if ('([{'.includes(char)) depth += 1;
    if (')]}'.includes(char)) depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  return [...parts, current];
}

/** The pattern of a parameter taken apart in the signature: up to the bracket that closes the first one. */
function patternOf(parameter: string): string {
  let depth = 0;
  for (let at = 0; at < parameter.length; at += 1) {
    if ('[{'.includes(parameter[at])) depth += 1;
    if (']}'.includes(parameter[at])) depth -= 1;
    if (depth === 0) return parameter.slice(0, at + 1).replace(/\s+/g, ' ');
  }
  return parameter;
}

// "replaceIndex = false" -> "replaceIndex"; "limits = { a: 1 }" -> "limits"; "{ id, venueData }" stays.
function nameOf(parameter: string): string {
  const trimmed = parameter.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return patternOf(trimmed);
  return /^(\.\.\.)?[A-Za-z_$][\w$]*/.exec(trimmed)?.[0] ?? '';
}

/**
 * The names a function gives its parameters, read from its source, so a command's arguments are
 * described by the command itself and cannot drift from it (#190). An object taken apart in the
 * signature is described by its pattern. The main process is compiled, never minified, so the names
 * survive the build (the CLI's E2E spec checks one in the built app).
 *
 * Usage:
 *   parameterNames((projectId: number, date: string) => 0); // ['projectId', 'date']
 */
export function parameterNames(fn: CommandFn): string[] {
  return splitTopLevel(parameterList(fn.toString())).map(nameOf).filter(Boolean);
}
