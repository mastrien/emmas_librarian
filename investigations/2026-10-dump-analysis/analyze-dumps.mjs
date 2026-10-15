// Runs cdb over every .dmp under the given folder and prints the parts that explain an access violation:
// the exception record (which address was read), the faulting instructions, registers, the stack and the modules.
// Usage: node analyze-dumps.mjs <folder with the downloaded result-root-* artifacts>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CDB = 'C:\\Program Files (x86)\\Windows Kits\\10\\Debuggers\\x86\\cdb.exe';
const OUT = path.resolve('dump-analysis');
const COMMANDS = [
  '.ecxr', '.echo ==EXCEPTION-RECORD==', '.exr -1', '.echo ==REGISTERS==', 'r',
  '.echo ==DISASSEMBLY-AROUND-FAULT==', 'ub @eip L10', 'u @eip L8',
  '.echo ==STACK-WITH-ARGS==', 'kv 10', '.echo ==STACK-RAW==', 'dd @esp L30',
  '.echo ==MODULES==', 'lm', '.echo ==SYSTEM-DLL-HEADER==', '!dh System', 'q',
].join('; ');

function dumpFiles(root) {
  return fs.readdirSync(root, { recursive: true }).map(String).filter((f) => f.endsWith('.dmp')).map((f) => path.join(root, f));
}

function analyze(dump) {
  const run = spawnSync(CDB, ['-z', dump, '-c', COMMANDS], { encoding: 'utf-8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  return `${run.stdout ?? ''}${run.stderr ?? ''}`;
}

const root = process.argv[2];
if (!root) throw new Error('Missing folder. Expected: node analyze-dumps.mjs <folder containing .dmp files>.');
fs.mkdirSync(OUT, { recursive: true });
for (const dump of dumpFiles(root)) {
  const text = analyze(dump);
  fs.writeFileSync(path.join(OUT, `${path.basename(dump)}.txt`), text);
  console.log(`\n######## ${dump}\n${text.split(/\r?\n/).filter((l) => !/NatVis|Extension|Repository|^\s*$/.test(l)).join('\n')}`);
}
