// Exp 011 — Capabilities fichier WASI : deny-by-default + allow-list de chemins.
// 3 scénarios × 3 runtimes (wasmtime, wazero, node:wasi), même module `filecap` :
//   S1 grant   : lecture DANS le dossier accordé    → attendu ok
//   S2 escape  : tentative de sortie (../secret)    → attendu err (refus)
//   S3 nogrant : aucun dossier accordé              → attendu err (refus par défaut)
// Sortie : wasi_caps.json (preuve brute) + tableau markdown. Exit 0 si tous les checks passent.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WASM = path.join(HERE, '..', 'samples', 'filecap', 'target', 'wasm32-wasip1', 'release', 'filecap.wasm');
const CAPDATA = path.join(HERE, 'capdata');
const SECRET = path.join(HERE, 'secret.txt');
const RUNS = Number(process.env.BENCH_RUNS ?? 3);

fs.writeFileSync(path.join(CAPDATA, 'input.txt'), 'BONJOUR-WASM-CAP');
fs.writeFileSync(SECRET, 'SECRET-HORS-GRANT');

function findWasmtime() {
  const base = path.join(os.homedir(), '.local', 'bin');
  const dir = (fs.existsSync(base) ? fs.readdirSync(base) : []).find((d) => d.startsWith('wasmtime'));
  if (!dir) throw new Error('wasmtime introuvable dans ~/.local/bin');
  return path.join(base, dir, 'wasmtime.exe');
}
function findWazero() {
  const c = [path.join(os.tmpdir(), 'opencode', 'wazero', 'wazero.exe')];
  for (const p of c) if (fs.existsSync(p)) return p;
  throw new Error('wazero introuvable (%TEMP%\\opencode\\wazero)');
}

const wt = findWasmtime();
const wz = findWazero();

// argv du guest : S2 tente explicitement de sortir du preopen
const TARGETS = {
  grant: 'data/input.txt',
  escape: 'data/../secret.txt',
  nogrant: 'data/input.txt',
};
const EXPECT = { grant: 'ok', escape: 'err', nogrant: 'err' };

const runtimes = [
  {
    id: 'wasmtime',
    label: 'wasmtime 49 (Cranelift)',
    argv: (scenario) =>
      scenario === 'grant'
        ? [wt, ['run', '--dir', 'capdata::data', WASM, TARGETS.grant]]
        : scenario === 'escape'
          ? [wt, ['run', '--dir', 'capdata::data', WASM, TARGETS.escape]]
          : [wt, ['run', WASM, TARGETS.nogrant]],
  },
  {
    id: 'wazero',
    label: 'wazero 1.12 (moteur Go)',
    argv: (scenario) =>
      scenario === 'grant'
        ? [wz, ['run', '-mount', 'capdata:data', WASM, TARGETS.grant]]
        : scenario === 'escape'
          ? [wz, ['run', '-mount', 'capdata:data', WASM, TARGETS.escape]]
          : [wz, ['run', WASM, TARGETS.nogrant]],
  },
  {
    id: 'node-wasi',
    label: 'node:wasi (V8)',
    env: { WASI_PREOPENS: JSON.stringify({ data: CAPDATA }) },
    argv: (scenario) => {
      const base = [
        process.execPath,
        ['--experimental-wasi-unstable-preview1', path.join(HERE, 'node_wasi.mjs'), WASM],
      ];
      // nogrant : même cible, mais env WASI_PREOPENS retiré par le pilote (aucun preopen)
      const target =
        scenario === 'grant' ? TARGETS.grant : scenario === 'escape' ? TARGETS.escape : TARGETS.nogrant;
      return [base[0], [...base[1], target]];
    },
  },
];

let allOk = true;
const results = [];
const checks = [];

for (const rt of runtimes) {
  for (const scenario of ['grant', 'escape', 'nogrant']) {
    const statuses = [];
    const samples = [];
    let lastLine = null;
    for (let i = 0; i < RUNS; i++) {
      const [cmd, args] = rt.argv(scenario);
      const env = { ...process.env };
      delete env.WASI_PREOPENS;
      if (scenario === 'grant') Object.assign(env, rt.env ?? {});
      const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, env, cwd: HERE });
      const line = (r.stdout ?? '').split(/\r?\n/).filter((l) => l.trim().startsWith('{')).pop();
      if (!line) {
        console.error(`[FAIL ${rt.id}/${scenario}] aucune JSON (status=${r.status}) ${r.stderr?.slice(0, 200)}`);
        allOk = false;
        break;
      }
      const j = JSON.parse(line);
      statuses.push(j.status);
      samples.push(j.elapsed_us);
      lastLine = j;
    }
    if (statuses.length !== RUNS) {
      allOk = false;
      break;
    }
    const status = statuses.every((s) => s === statuses[0]) ? statuses[0] : `mixed:${statuses.join('/')}`;
    const pass = status === EXPECT[scenario];
    checks.push({ id: `${rt.id}/${scenario}`, pass, got: status, expect: EXPECT[scenario] });
    if (!pass) allOk = false;
    // S1 : contrôle d'intégrité du contenu lu (len + somme octets identiques partout)
    if (scenario === 'grant' && (lastLine.len !== 16 || lastLine.byte_sum !== 1157)) {
      checks.push({ id: `${rt.id}/grant-content`, pass: false, detail: `len=${lastLine.len} sum=${lastLine.byte_sum}` });
      allOk = false;
    }
    results.push({
      runtime: rt.id,
      label: rt.label,
      scenario,
      status,
      expect: EXPECT[scenario],
      ...(lastLine ?? {}),
      runs: RUNS,
    });
    console.log(
      `${pass ? '✅' : '❌'} ${rt.label} · ${scenario} → ${status}${lastLine?.error ? ` (${lastLine.error})` : ''}`,
    );
  }
}

const out = {
  date: new Date().toISOString(),
  machine: `win32 x64 ${process.version}`,
  module: 'filecap.wasm (wasm32-wasip1)',
  targets: TARGETS,
  checks,
  results,
  all_runtimes_agree: allOk,
};
fs.writeFileSync(path.join(HERE, 'wasi_caps.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\nTous les scénarios conformes (ok/err/err) : ${allOk}`);
console.log(`-> ${path.join(HERE, 'wasi_caps.json')}`);
process.exit(allOk ? 0 : 1);
