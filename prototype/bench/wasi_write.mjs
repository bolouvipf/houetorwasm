// Exp 012 — Écriture sous capabilities WASI : preopen rw, ro, hors-preopen, aucun.
// Scénarios × runtimes (wasmtime, wazero, node:wasi) sur le module `filewrite` :
//   grant-write : écriture DANS le dossier accordé (rw)      → attendu ok
//   ro-write    : écriture sur preopen read-only             → attendu err (wasmtime/node : n/a CLI)
//   escape-write: écriture hors du dossier accordé (../)     → attendu err
//   nogrant     : aucun dossier accordé                      → attendu err
// Contrôles hôte : capdata/out.txt contient la valeur, evil.txt N'EXISTE PAS.
// Sortie : wasi_write.json. Exit 0 si tous les checks passent.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WASM = path.join(HERE, '..', 'samples', 'filecap', 'target', 'wasm32-wasip1', 'release', 'filewrite.wasm');
const CAPDATA = path.join(HERE, 'capdata');
const OUT = path.join(CAPDATA, 'out.txt');
const EVIL = path.join(HERE, 'evil.txt');
const CONTENT = 'ECRITURE-WASM';
const RUNS = Number(process.env.BENCH_RUNS ?? 3);

fs.mkdirSync(CAPDATA, { recursive: true });
for (const f of [OUT, EVIL]) fs.rmSync(f, { force: true });

function findWasmtime() {
  const base = path.join(os.homedir(), '.local', 'bin');
  const dir = (fs.existsSync(base) ? fs.readdirSync(base) : []).find((d) => d.startsWith('wasmtime'));
  if (!dir) throw new Error('wasmtime introuvable');
  return path.join(base, dir, 'wasmtime.exe');
}
function findWazero() {
  const p = path.join(os.tmpdir(), 'opencode', 'wazero', 'wazero.exe');
  if (fs.existsSync(p)) return p;
  throw new Error('wazero introuvable');
}
const wt = findWasmtime();
const wz = findWazero();

const TARGETS = {
  'grant-write': 'data/out.txt',
  'ro-write': 'data/out.txt',
  'escape-write': 'data/../evil.txt',
  'nogrant-write': 'data/out.txt',
};
const EXPECT = { 'grant-write': 'ok', 'ro-write': 'err', 'escape-write': 'err', 'nogrant-write': 'err' };

const runtimes = [
  {
    id: 'wasmtime',
    label: 'wasmtime 49 (Cranelift)',
    // wasmtime 49 CLI : --dir rw seulement (aucun --rodir : preuve wasi_caps/docs)
    supportsRo: false,
    argv: (s) =>
      s === 'grant-write' || s === 'ro-write'
        ? [wt, ['run', '--dir', 'capdata::data', WASM, TARGETS[s], CONTENT]]
        : s === 'escape-write'
          ? [wt, ['run', '--dir', 'capdata::data', WASM, TARGETS[s], CONTENT]]
          : [wt, ['run', WASM, TARGETS[s], CONTENT]],
  },
  {
    id: 'wazero',
    label: 'wazero 1.12 (moteur Go)',
    supportsRo: true,
    argv: (s) =>
      s === 'grant-write'
        ? [wz, ['run', '-mount', 'capdata:data', WASM, TARGETS[s], CONTENT]]
        : s === 'ro-write'
          ? [wz, ['run', '-mount', 'capdata:data:ro', WASM, TARGETS[s], CONTENT]]
          : s === 'escape-write'
            ? [wz, ['run', '-mount', 'capdata:data', WASM, TARGETS[s], CONTENT]]
            : [wz, ['run', WASM, TARGETS[s], CONTENT]],
  },
  {
    id: 'node-wasi',
    label: 'node:wasi (V8)',
    supportsRo: false, // node:wasi : preopens rw uniquement (pas d'option ro)
    env: { WASI_PREOPENS: JSON.stringify({ data: CAPDATA }) },
    argv: (s) => {
      const target = TARGETS[s];
      const args = ['--experimental-wasi-unstable-preview1', path.join(HERE, 'node_wasi.mjs'), WASM, target, CONTENT];
      return [process.execPath, args];
    },
  },
];

let allOk = true;
const results = [];
const checks = [];
const note = (id, pass, detail) => {
  checks.push({ id, pass, ...(detail ? { detail } : {}) });
  if (!pass) allOk = false;
};

for (const rt of runtimes) {
  for (const scenario of ['grant-write', 'ro-write', 'escape-write', 'nogrant-write']) {
    if (scenario === 'ro-write' && !rt.supportsRo) {
      results.push({ runtime: rt.id, label: rt.label, scenario, status: 'n/a', expect: 'err', note: 'CLI/impl sans preopen read-only' });
      console.log(`⚪ ${rt.label} · ${scenario} → n/a (pas de preopen ro disponible)`);
      continue;
    }
    const statuses = [];
    let lastLine = null;
    for (let i = 0; i < RUNS; i++) {
      const [cmd, args] = rt.argv(scenario);
      const env = { ...process.env };
      delete env.WASI_PREOPENS;
      // preopen présent sur grant/ro/escape (la traversée ../ ne se teste qu'avec un preopen)
      if (scenario !== 'nogrant-write') Object.assign(env, rt.env ?? {});
      const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, env, cwd: HERE });
      const line = (r.stdout ?? '').split(/\r?\n/).filter((l) => l.trim().startsWith('{')).pop();
      if (!line) {
        note(`${rt.id}/${scenario}`, false, `aucune JSON (status=${r.status})`);
        allOk = false;
        break;
      }
      const j = JSON.parse(line);
      statuses.push(j.status);
      lastLine = j;
    }
    if (statuses.length !== RUNS) break;
    const status = statuses.every((s) => s === statuses[0]) ? statuses[0] : `mixed:${statuses.join('/')}`;
    const pass = status === EXPECT[scenario];
    note(`${rt.id}/${scenario}`, pass, `got=${status} expect=${EXPECT[scenario]}`);
    if (scenario === 'grant-write' && status === 'ok' && lastLine?.verify_len !== CONTENT.length) {
      note(`${rt.id}/${scenario}/verify`, false, `verify_len=${lastLine?.verify_len}`);
    }
    results.push({ runtime: rt.id, label: rt.label, scenario, status, expect: EXPECT[scenario], ...(lastLine ?? {}), runs: RUNS });
    console.log(`${pass ? '✅' : '❌'} ${rt.label} · ${scenario} → ${status}${lastLine?.error ? ` (${lastLine.error})` : ''}`);
  }
}

// Contrôles hôte (fichiers réellement écrits par le guest rw)
const hostOutOk = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === CONTENT;
const evilAbsent = !fs.existsSync(EVIL);
note('host/out.txt', hostOutOk, hostOutOk ? `contenu=${CONTENT}` : 'contenu absent/différent');
note('host/evil.txt absent', evilAbsent, evilAbsent ? 'jamais créé' : 'CRÉÉ = évasion !');
console.log(`${hostOutOk ? '✅' : '❌'} hôte : capdata/out.txt = "${hostOutOk ? CONTENT : '?'}"`);
console.log(`${evilAbsent ? '✅' : '❌'} hôte : evil.txt absent = ${evilAbsent}`);

const out = {
  date: new Date().toISOString(),
  machine: `win32 x64 ${process.version}`,
  module: 'filewrite.wasm (wasm32-wasip1)',
  targets: TARGETS,
  checks,
  results,
  all_checks_pass: allOk,
};
fs.writeFileSync(path.join(HERE, 'wasi_write.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\nTous les checks passent : ${allOk}`);
console.log(`-> ${path.join(HERE, 'wasi_write.json')}`);
process.exit(allOk ? 0 : 1);
