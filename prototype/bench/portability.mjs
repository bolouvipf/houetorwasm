// Exp 007 — Portabilité : le MÊME binaire WASM exécuté par plusieurs runtimes.
// Médiane de 5 exécutions en processus neuf par jambe ; vérifie que `result`
// est identique partout. Écrit portability.json + affiche un tableau markdown.
//
// Jambes :
//   1. wasmtime 49   — moteur Cranelift, composant WASI p2
//   2. wasmtime 49   — moteur Cranelift, module WASI p1
//   3. wazero 1.12   — moteur pur Go, module WASI p1 (runtime indépendant n°2)
//   4. node:wasi     — moteur V8, WASI intégré, module WASI p1 (exécuteur n°3)
//
// Prérequis : fib_wasi construit pour p1 ET p2 (voir phase3_measures.md §7),
// wazero téléchargé (https://github.com/tetratelabs/wazero/releases) →
// %TEMP%\opencode\wazero\wazero.exe ou `wazero` sur le PATH.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const K = Number(process.env.BENCH_K ?? 10_000_000);
const N = 45;
const EXPECTED = '1134903170'; // fib(45)
const P1 = path.join(HERE, 'fib_wasi', 'target', 'wasm32-wasip1', 'release', 'fib-wasi.wasm');
const P2 = path.join(HERE, 'fib_wasi', 'target', 'wasm32-wasip2', 'release', 'fib-wasi.wasm');

function findWasmtime() {
  const base = path.join(os.homedir(), '.local', 'bin');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base) : [];
  const dir = dirs.find((d) => d.startsWith('wasmtime'));
  if (!dir) throw new Error('wasmtime introuvable dans ~/.local/bin');
  return path.join(base, dir, 'wasmtime.exe');
}

function findWazero() {
  const cand = [
    path.join(os.tmpdir(), 'opencode', 'wazero', 'wazero.exe'),
    'wazero.exe',
  ];
  for (const c of cand) {
    if (c === 'wazero.exe' || fs.existsSync(c)) return c;
  }
  throw new Error('wazero introuvable (%TEMP%\\opencode\\wazero ou PATH)');
}

const wasmtime = findWasmtime();
const wazero = findWazero();

const legs = [
  {
    id: 'wasmtime-p2',
    label: 'wasmtime 49 (Cranelift) — composant WASI p2',
    argv: () => [wasmtime, ['run', P2, String(K), String(N), 'wasmtime-p2']],
  },
  {
    id: 'wasmtime-p1',
    label: 'wasmtime 49 (Cranelift) — module WASI p1',
    argv: () => [wasmtime, ['run', P1, String(K), String(N), 'wasmtime-p1']],
  },
  {
    id: 'wazero-p1',
    label: 'wazero 1.12 (moteur Go) — module WASI p1',
    argv: () => [wazero, ['run', P1, String(K), String(N), 'wazero']],
  },
  {
    id: 'node-wasi-p1',
    label: 'node:wasi (V8) — module WASI p1',
    argv: () => [
      process.execPath,
      [
        '--experimental-wasi-unstable-preview1',
        path.join(HERE, 'node_wasi.mjs'),
        P1,
        String(K),
        String(N),
        'node-wasi',
      ],
    ],
  },
];

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const results = [];
let allOk = true;

for (const leg of legs) {
  const samples = [];
  const parsed = [];
  for (let i = 0; i < RUNS; i++) {
    const [cmd, args] = leg.argv();
    const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) {
      console.error(`[FAIL ${leg.id}] status=${r.status} stderr=${(r.stderr ?? '').slice(0, 300)}`);
      allOk = false;
      break;
    }
    const line = (r.stdout ?? '')
      .split(/\r?\n/)
      .filter((l) => l.trim().startsWith('{'))
      .pop();
    if (!line) {
      console.error(`[FAIL ${leg.id}] aucune ligne JSON: ${r.stdout?.slice(0, 200)}`);
      allOk = false;
      break;
    }
    const j = JSON.parse(line);
    if (j.result !== EXPECTED) {
      console.error(`[FAIL ${leg.id}] result=${j.result} != ${EXPECTED}`);
      allOk = false;
      break;
    }
    parsed.push(j);
    samples.push(j.per_call_ns);
  }
  if (parsed.length !== RUNS) continue;
  const firsts = parsed.map((p) => p.first_call_us);
  results.push({
    id: leg.id,
    label: leg.label,
    runs: RUNS,
    k: K,
    n: N,
    status: 'ok',
    result: parsed[0].result,
    per_call_ns: median(samples),
    first_call_us: median(firsts),
  });
}

const out = {
  date: new Date().toISOString(),
  machine: `win32 x64 ${process.version}`,
  workload: `fib(45) x ${K} appels (médiane de ${RUNS} exécutions), même binaire WASM`,
  expected_result: EXPECTED,
  all_runtimes_agree: allOk && results.length === legs.length,
  results,
};
fs.writeFileSync(path.join(HERE, 'portability.json'), JSON.stringify(out, null, 2) + '\n');

console.log('\n| Runtime (même binaire WASM) | 1er appel (µs) | par appel (ns) | résultat |');
console.log('|---|---:|---:|---|');
for (const r of results) {
  console.log(`| ${r.label} | ${r.first_call_us} | ${r.per_call_ns} | \`${r.result}\` |`);
}
console.log(`\nTous les runtimes s'accordent : ${out.all_runtimes_agree}`);
console.log(`-> ${path.join(HERE, 'portability.json')}`);
process.exit(out.all_runtimes_agree ? 0 : 1);
