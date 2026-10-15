// H1 follow-up: is the first-run 0xC0000005 Microsoft Defender ending the installer? It leaves no crash
// event and no dump (round 2), which a real crash would. Compares real-time protection on and off.
// Usage: node defender-first-run.mjs <on|off> <attempt>   (installer: env INSTALLER_PUBLISHED_1_1_23)
import os from 'node:os';
import path from 'node:path';
import {
  crashEvents,
  defenderEvents,
  defenderStatus,
  installSync,
  setDefenderRealtime,
  sleep,
  writeResult,
} from './lib.mjs';

const [realtime, attempt] = process.argv.slice(2);
if (!['on', 'off'].includes(realtime)) throw new Error(`Expected "on" or "off", got "${realtime}".`);

if (realtime === 'off') setDefenderRealtime(false);
const statusBefore = defenderStatus();
const since = new Date();
const run = installSync(process.env.INSTALLER_PUBLISHED_1_1_23, path.join(os.tmpdir(), 'defender', 'app'));
console.log(`first run with real-time ${realtime}: ${run.statusHex} in ${run.ms} ms`);
// Defender writes its events a little after acting.
await sleep(5000);

writeResult(`defender-${realtime}-${attempt}`, {
  experiment: 'defender-first-run',
  realtime,
  attempt: Number(attempt),
  statusBefore,
  run,
  defenderEvents: defenderEvents(since),
  crashEvents: crashEvents(since),
});
