// Exp 008 — Temps d'installation / mise à jour / retrait (critère §7 non mesuré jusqu'ici).
// Médiane de 5 cycles ; chaque opération = 1 invocation CLI du host.
// Le spawn de Node fausse les micros-opérations fs : on mesure aussi un
// baseline (`node -e ""`) et on publie le net (wall - baseline), preuve brute incluse.
//
// Plugin témoin : `lifecycleprobe` (wasm de hello en copie, versions 1.0.0 → 1.0.1),
// créé/détruit en TMP — hello et needy ne sont jamais touchés.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOST = path.join(HERE, '..', 'host', 'host.mjs');
const PLUGINS = path.join(HERE, '..', 'plugins');
const PROBE = 'lifecycleprobe';
const SRC = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycleprobe-src-'));
const CYCLES = Number(process.env.BENCH_RUNS ?? 5);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function writeProbe(version) {
  const dir = path.join(SRC, version);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify(
      {
        name: PROBE,
        version,
        wasm: 'p.wasm',
        description: 'Plugin temoin lifecycle (bench Exp 008)',
        exports: ['add', 'fibonacci', 'plugin_version'],
        permissions: [],
        entry_abi: 'core-wasm-f64-f64',
      },
      null,
      2,
    ),
  );
  fs.copyFileSync(path.join(PLUGINS, 'hello', 'hello.wasm'), path.join(dir, 'p.wasm'));
  return dir;
}

function host(cmd, ...args) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [HOST, cmd, ...args], { encoding: 'utf8', windowsHide: true });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function baseline() {
  const t0 = process.hrtime.bigint();
  spawnSync(process.execPath, ['-e', ''], { windowsHide: true });
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

const v1 = writeProbe('1.0.0');
const v2 = writeProbe('1.0.1');

// état propre : retirer un éventuel reste d'un run précédent
host('remove', PROBE);

const ops = { install: [], install_dup: [], update: [], remove: [] };
let checks = { dup_refused: false, update_ok: false, remove_ok: false, probe_gone: false, hello_intact: false };
const raw = [];

for (let c = 0; c < CYCLES; c++) {
  const a = host('install', v1);              // 1. installation initiale
  const b = host('install', v1);              // 2. réinstallation même version → refus attendu
  const cU = host('install', v2);             // 3. mise à jour (version différente → archive + copie)
  const d = host('remove', PROBE);            // 4. retrait
  ops.install.push(a.ms);
  ops.install_dup.push(b.ms);
  ops.update.push(cU.ms);
  ops.remove.push(d.ms);
  raw.push({ cycle: c + 1, install: a, install_dup: b, update: cU, remove: d });
  if (b.status !== 0) checks.dup_refused = true;
  if (cU.status === 0) checks.update_ok = true;
  if (d.status === 0) checks.remove_ok = true;
}

checks.probe_gone = !fs.existsSync(path.join(PLUGINS, PROBE));
checks.hello_intact =
  fs.existsSync(path.join(PLUGINS, 'hello', 'manifest.json')) &&
  JSON.parse(fs.readFileSync(path.join(PLUGINS, 'hello', 'manifest.json'), 'utf8')).version === '1.0.1';

const base = median(Array.from({ length: CYCLES }, baseline));
const med = Object.fromEntries(
  Object.entries(ops).map(([k, v]) => [k, { wall_ms: +median(v).toFixed(1), net_ms: +(median(v) - base).toFixed(1) }]),
);

const out = {
  date: new Date().toISOString(),
  machine: `win32 x64 ${process.version}`,
  cycles: CYCLES,
  baseline_spawn_ms: +base.toFixed(1),
  note: 'net_ms = médiane wall moins baseline spawn node (opérations fs locales)',
  results: med,
  checks,
};
fs.writeFileSync(path.join(HERE, 'lifecycle.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(HERE, 'lifecycle.raw.json'), JSON.stringify(raw, null, 2) + '\n');

console.log('\n| Opération (host CLI) | wall médiane (ms) | net fs (ms) |');
console.log('|---|---:|---:|');
for (const [k, v] of Object.entries(med)) {
  console.log(`| ${k} | ${v.wall_ms} | ${v.net_ms} |`);
}
console.log(`\nbaseline spawn node = ${out.baseline_spawn_ms} ms`);
console.log(
  `checks: ${Object.entries(checks)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')}`,
);
console.log(`-> ${path.join(HERE, 'lifecycle.json')}`);
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
