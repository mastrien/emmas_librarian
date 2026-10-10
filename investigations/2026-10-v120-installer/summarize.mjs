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

const defender = results.filter((r) => r.experiment === 'defender-first-run');
if (defender.length) {
  lines.push('', '## H1: Defender e o travamento na 1ª execução', '', '| tempo real | tentativa | 1ª execução | eventos do Defender |', '|---|---|---|---|');
  for (const r of defender.sort((a, b) => a.realtime.localeCompare(b.realtime) || a.attempt - b.attempt)) {
    const events = r.defenderEvents.map((e) => `${e.id}: ${e.message.slice(0, 120)}`).join('<br>') || '—';
    lines.push(`| ${r.realtime} | ${r.attempt} | ${r.run.statusHex} (${r.run.ms} ms) | ${events} |`);
  }
}

const stuck = results.filter((r) => r.experiment === 'stuck-installer');
if (stuck.length) {
  lines.push('', '## H2: instalador preso', '', '| reabre após | tentativa | versão ao reabrir (r1, r2) | instaladores: saída (ms desde o início) | vivos quando a versão final abriu | versão ao abrir / depois de tudo | arquivos: antigos, novos, iguais nas duas, nenhuma | app final falhou? |', '|---|---|---|---|---|---|---|---|');
  for (const r of stuck.sort((a, b) => a.reopenAfterMs - b.reopenAfterMs || a.attempt - b.attempt)) {
    const reopened = r.rounds.map((x) => x.versionWhenReopened ?? 'sem exe').join(', ');
    const exits = r.installers.map((i) => `r${i.round}: ${i.exit ? `${i.exit.statusHex} (${i.exit.at})` : 'não terminou'}`).join('; ');
    const f = r.finalFilesAfterAll;
    lines.push(`| ${r.reopenAfterMs / 1000} s | ${r.attempt} | ${reopened} | ${exits} | ${r.aliveAtFinalStart.join(', ') || 'nenhum'} | ${r.finalVersionAtStart} / ${r.finalVersionAfterAll} | ${f.old}, ${f.new}, ${f.both}, ${f.neither.length} | ${r.finalStartFailed ? 'sim' : 'não'} |`);
  }
}

const markdown = lines.join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
