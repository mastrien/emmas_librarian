import path from 'path';
import ts from 'typescript';
import type { CommandSchema, ParameterSchema } from '../../core/harness/commandSchema';
import { newWalk, schemaOfType } from './typeToSchema';

interface ExtractContext {
  checker: ts.TypeChecker;
  /** Paths are written relative to this folder, so the output does not depend on where the repo lives. */
  root: string;
}

// The compiler writes paths with `/` on every system; the caller's may use `\` on Windows.
const slashed = (file: string): string => file.split(path.sep).join('/');

const isRegistryAdd = (call: ts.CallExpression, checker: ts.TypeChecker): boolean => {
  if (!ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'add') return false;
  return checker.typeToString(checker.getTypeAtLocation(call.expression.expression)) === 'CommandRegistry';
};

/** The command name: a string literal, or an enum member such as `IpcChannel.DIARY_SAVE`, read as its value. */
function commandNameOf(node: ts.Expression, checker: ts.TypeChecker): string | undefined {
  const type = checker.getTypeAtLocation(node);
  return type.isStringLiteral() ? type.value : undefined;
}

function parameterNameOf(parameter: ts.ParameterDeclaration): string {
  if (ts.isIdentifier(parameter.name)) return parameter.name.text;
  // `({ id, venueData }) => ...` is one argument, an object; the registry calls it by its pattern.
  return parameter.name.getText().replace(/\s+/g, ' ');
}

function isOptional(parameter: ts.ParameterDeclaration, type: ts.Type): boolean {
  if (parameter.questionToken || parameter.initializer) return true;
  return type.isUnion() && type.types.some((member) => member.flags & ts.TypeFlags.Undefined);
}

// `(replaceIndex = false)` has no annotation, and inside `commands.add` its contextual type is the registry's
// `never`; the type of the default value, widened (`false` -> boolean), is what the handler really takes.
function typeOfParameter(parameter: ts.ParameterDeclaration, checker: ts.TypeChecker): ts.Type {
  if (parameter.type || !parameter.initializer) return checker.getTypeAtLocation(parameter);
  return checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(parameter.initializer));
}

function parameterSchemaOf(parameter: ts.ParameterDeclaration, context: ExtractContext): ParameterSchema {
  const type = typeOfParameter(parameter, context.checker);
  return {
    name: parameterNameOf(parameter),
    required: !isOptional(parameter, type),
    schema: schemaOfType(type, newWalk(context.checker)),
  };
}

// The comment above the `commands.add(...)` statement, if there is one: it is what a person wrote about the command.
function commentAbove(call: ts.CallExpression): string | undefined {
  const statement = ts.findAncestor(call, ts.isExpressionStatement) ?? call;
  const source = statement.getSourceFile();
  const ranges = ts.getLeadingCommentRanges(source.text, statement.getFullStart());
  const text = ranges?.map((range) => source.text.slice(range.pos, range.end)).join('\n');
  return text?.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/)\s?/gm, '').trim() || undefined;
}

function lineOf(node: ts.Node, root: string): string {
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart());
  return `${path.relative(root, source.fileName).split(path.sep).join('/')}:${line + 1}`;
}

function commandFrom(call: ts.CallExpression, context: ExtractContext): CommandSchema | undefined {
  const [nameNode, handler] = call.arguments;
  const name = nameNode && commandNameOf(nameNode, context.checker);
  if (!name || !handler || !(ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))) return undefined;
  const description = commentAbove(call);
  return {
    name,
    parameters: handler.parameters.map((parameter) => parameterSchemaOf(parameter, context)),
    ...(description ? { description } : {}),
    source: lineOf(call, context.root),
  };
}

function collect(source: ts.SourceFile, context: ExtractContext): CommandSchema[] {
  const found: CommandSchema[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isRegistryAdd(node, context.checker)) {
      const command = commandFrom(node, context);
      if (command) found.push(command);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * Reads every `commands.add(NAME, (args...) => ...)` in the given files and describes each command's
 * arguments from the types written in the handler, so the schema cannot drift from the code (#27).
 *
 * Usage:
 *   const commands = extractCommandSchemas({ root, files, options }); // [{ name: 'diary:save', parameters: [...] }]
 */
export function extractCommandSchemas(input: {
  root: string;
  files: string[];
  options: ts.CompilerOptions;
}): CommandSchema[] {
  const program = ts.createProgram(input.files, input.options);
  const context: ExtractContext = { checker: program.getTypeChecker(), root: input.root };
  const wanted = new Set(input.files.map(slashed));
  const sources = program.getSourceFiles().filter((file) => wanted.has(slashed(file.fileName)));
  const byName = sources.flatMap((source) => collect(source, context));
  return byName.sort((first, second) => first.name.localeCompare(second.name));
}
