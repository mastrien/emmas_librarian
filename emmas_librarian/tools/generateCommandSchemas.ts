import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { extractCommandSchemas } from './commandSchemas/extractCommandSchemas';

const OUTPUT = 'core/harness/commandSchemas.generated.json';
const COMMANDS_FOLDER = 'core/commands';

function commandFiles(root: string): string[] {
  const folder = path.join(root, COMMANDS_FOLDER);
  return fs
    .readdirSync(folder)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => path.join(folder, file));
}

function compilerOptionsOf(root: string): ts.CompilerOptions {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.electron.json'), ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
}

/**
 * Writes the schema of every library command, read from the handlers, next to the harness that uses it.
 * Run from the app folder: `npm run schemas:generate`. `--check` writes nothing and fails when the file is stale.
 */
function main(): void {
  const root = process.cwd();
  const schemas = extractCommandSchemas({ root, files: commandFiles(root), options: compilerOptionsOf(root) });
  const text = `${JSON.stringify({ commands: schemas }, null, 2)}\n`;
  const target = path.join(root, OUTPUT);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (current === text) return;
    console.error(`${OUTPUT} is out of date; expected: run \`npm run schemas:generate\` and commit the result`);
    process.exit(1);
  }
  fs.writeFileSync(target, text);
  console.log(`${schemas.length} commands written to ${OUTPUT}`);
}

main();
