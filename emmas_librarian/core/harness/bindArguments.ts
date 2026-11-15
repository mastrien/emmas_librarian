import { usageError } from '../errors/usageError';
import { checkValue, type Violation } from './checkValue';
import type { CommandSchema, ParameterSchema } from './commandSchema';
import { describeSchema } from './describeSchema';

/**
 * The key a model uses for one argument. A handler that takes an object apart in its signature
 * (`({ id, venueData }) => ...`) has no name for it, so the argument is called `input`.
 */
export const argumentKey = (parameter: ParameterSchema): string =>
  /^[A-Za-z_$][\w$]*$/.test(parameter.name) ? parameter.name : 'input';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What the command takes, in the form it is shown when a call is refused: `projectId: número; date: texto`. */
export function describeArguments(command: CommandSchema): string {
  const fields = command.parameters.map(
    (parameter) => `${argumentKey(parameter)}${parameter.required ? '' : '?'}: ${describeSchema(parameter.schema)}`,
  );
  return fields.length > 0 ? fields.join('; ') : 'nenhum argumento';
}

function refuse(command: CommandSchema, offending: string): never {
  throw usageError(
    'ERR_INVALID_ARGUMENTS',
    `Argumentos inválidos para "${command.name}". Offending value: ${offending}`,
    describeArguments(command),
  );
}

const describeViolation = ({ path, given, expected }: Violation): string => `${path} = ${given}, esperado ${expected}`;

function violationsOf(command: CommandSchema, input: Record<string, unknown>): Violation[] {
  const keys = new Set(command.parameters.map(argumentKey));
  const stray = Object.keys(input)
    .filter((key) => !keys.has(key))
    .map((key) => ({
      path: key,
      given: JSON.stringify(input[key]),
      expected: `um de: ${[...keys].join(', ') || 'nenhum'}`,
    }));
  const wrong = command.parameters.flatMap((parameter) => {
    const key = argumentKey(parameter);
    const value = input[key];
    if (value === undefined) {
      return parameter.required ? [{ path: key, given: 'ausente', expected: describeSchema(parameter.schema) }] : [];
    }
    return checkValue(value, parameter.schema, key);
  });
  return [...stray, ...wrong];
}

/**
 * Turns the object a model sent into the positional arguments the command takes, after checking every
 * one against its schema. Everything wrong is reported at once, so one retry can fix it. Trailing
 * optional arguments that were not given are left out, as a shell leaves them out.
 *
 * Usage:
 *   bindArguments(diarySave, { projectId: 3, date: '2026-11-14', content: 'Li dois artigos.' });
 *   // [3, '2026-11-14', 'Li dois artigos.']
 */
export function bindArguments(command: CommandSchema, input: unknown): unknown[] {
  if (!isPlainObject(input)) refuse(command, `${JSON.stringify(input) ?? 'ausente'} em vez de um objeto`);
  const violations = violationsOf(command, input);
  if (violations.length > 0) refuse(command, violations.map(describeViolation).join('; '));
  const positional = command.parameters.map((parameter) => input[argumentKey(parameter)]);
  while (positional.length > 0 && positional[positional.length - 1] === undefined) positional.pop();
  return positional;
}
