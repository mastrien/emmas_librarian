// Joins every runner's results/*.json into the Markdown tables of the workflow summary.
// Usage: node summarize.mjs <folder with the downloaded artifacts>
import fs from 'node:fs';
import path from 'node:path';

const folder = process.argv[2];
const results = fs
  .readdirSync(folder, { recursive: true })
  .filter((f) => String(f).endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(folder, String(f)), 'utf-8')));

const crashRate = results.filter((r) => r.experiment === 'crash-rate');
const interrupted = results.filter((r) => r.experiment === 'interrupted-update');
const lines = ['## H1: taxa de travamento do instalador', '', '| primeiro | tentativa | 1ª execução | demais (status) | eventos de travamento |', '|---|---|---|---|---|'];
for (const r of crashRate.sort((a, b) => a.first.localeCompare(b.first) || a.attempt - b.attempt)) {
  const [firstRun, ...rest] = r.runs;
  const others = rest.map((x) => `${x.label}:${x.statusHex}`).join(' ');
  const events = r.crashEvents.map((e) => `${e.app} → ${e.module} ${e.exception}`).join('; ') || '—';
  lines.push(`| ${r.first} | ${r.attempt} | ${firstRun.statusHex} (${firstRun.ms} ms) | ${others} | ${events} |`);
}
const runsByLabel = {};
for (const run of crashRate.flatMap((r) => r.runs)) {
  const entry = (runsByLabel[run.label] ??= { total: 0, crashed: 0, firstTotal: 0, firstCrashed: 0 });
  entry.total++;
  if (run.statusHex === '0xC0000005') entry.crashed++;
  if (run.order === 0) {
    entry.firstTotal++;
    if (run.statusHex === '0xC0000005') entry.firstCrashed++;
  }
}
lines.push('', '| instalador | travamentos / execuções | como 1ª execução do runner |', '|---|---|---|');
for (const [label, e] of Object.entries(runsByLabel)) {
  lines.push(`| ${label} | ${e.crashed} / ${e.total} | ${e.firstCrashed} / ${e.firstTotal} |`);
}

lines.push('', '## H2: atualização interrompida', '', '| reabre após | tentativa | ciclos (status → versão depois) | versão final | arquivos ≠ instalação limpa | app final falhou? |', '|---|---|---|---|---|---|');
for (const r of interrupted.sort((a, b) => (a.reopenAfterMs ?? -1) - (b.reopenAfterMs ?? -1) || a.attempt - b.attempt)) {
  const cycles = r.cycles.map((c) => `${c.installer.statusHex ?? c.installer.status} → ${c.versionAfter}`).join('; ');
  const d = r.finalDiffAgainstClean1_2_0;
  const diff = `faltam ${d.missing.length}, sobram ${d.extra.length}, diferem ${d.changed.length}`;
  const delay = r.reopenAfterMs === null ? 'não reabre' : `${r.reopenAfterMs / 1000} s`;
  lines.push(`| ${delay} | ${r.attempt} | ${cycles} | ${r.finalVersion} | ${diff} | ${r.finalStartFailed ? 'sim' : 'não'} |`);
}

const markdown = lines.join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
