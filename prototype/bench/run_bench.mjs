#!/usr/bin/env node
// Comparatif §8 (étude WASM plugins) : même fonctionnalité — fib(45) — en 4 implémentations.
//   1. natif-c            : fib.c compilé (MinGW gcc/clang)
//   2. python             : fib.py
//   3. javascript-node    : fib.js
//   4. wasm (plugin)      : hello@1.0.1 via le HOUETOR Plugin Host (host.mjs)
// Chaque variante : RUNS spawns ; on garde la médiane. Sortie : results.json + table markdown.
// Usage : node run_bench.mjs   (optionnel : BENCH_RUNS, BENCH_N)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // prototype/bench
const PROTO = path.resolve(HERE, "..");
const HOST = path.join(PROTO, "host", "host.mjs");
const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const N = Number(process.env.BENCH_N ?? 45);

const variants = [
  {
    id: "natif-c",
    label: "Natif (C, MinGW)",
    cmd: path.join(HERE, "fib_native.exe"),
    args: [],
    k: 10_000_000,
    size: path.join(HERE, "fib_native.exe"),
  },
  {
    id: "python",
    label: "Python 3.14",
    cmd: "python",
    args: [path.join(HERE, "fib.py")],
    k: 100_000,
    size: path.join(HERE, "fib.py"),
  },
  {
    id: "javascript-node",
    label: "JavaScript (Node 24)",
    cmd: process.execPath,
    args: [path.join(HERE, "fib.js")],
    k: 1_000_000,
    size: path.join(HERE, "fib.js"),
  },
  {
    id: "wasm-houetor",
    label: "WASM plugin (HOUETOR host / Node)",
    cmd: process.execPath,
    args: [HOST, "bench", "hello", "fibonacci", String(N), "{K}"], // {K} remplacé par v.k
    k: 10_000_000,
    size: path.join(PROTO, "plugins", "hello", "hello.wasm"),
  },
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const round = (x, d = 3) => (x == null ? null : +x.toFixed(d));

function spawnJson(v, k) {
  const args = v.args.map((a) => (a === "{K}" ? String(k) : a));
  const t0 = process.hrtime.bigint();
  const r = spawnSync(v.cmd, args, {
    encoding: "utf8",
    env: { ...process.env, BENCH_K: String(k), BENCH_N: String(N) },
    timeout: 120_000,
  });
  const wall_ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (r.error) return { wall_ms, error: r.error.message };
  const lines = (r.stdout ?? "").trim().split(/\r?\n/).filter(Boolean);
  let parsed = null;
  for (let i = lines.length - 1; i >= 0 && !parsed; i--) {
    try { parsed = JSON.parse(lines[i]); } catch { /* essaie la ligne précédente */ }
  }
  if (!parsed)
    return { wall_ms, error: `stdout illisible (exit=${r.status}) : ${((r.stderr ?? "") + (r.stdout ?? "")).slice(0, 300)}` };
  return { wall_ms, ...parsed };
}

function runVariant(v) {
  const base = { id: v.id, label: v.label, k: v.k, n: N, runs: RUNS };
  if (v.id === "natif-c" && !fs.existsSync(v.cmd))
    return { ...base, status: "absent", detail: "fib_native.exe non compilé (gcc/clang absent ? voir build_native.ps1)" };
  const runs = [];
  let error = null;
  for (let i = 0; i < RUNS; i++) {
    const r = spawnJson(v, v.k);
    if (r.error) { error = r.error; break; }
    runs.push(r);
  }
  if (!runs.length) return { ...base, status: "erreur", detail: error };
  const pick = (key, d) => round(median(runs.map((r) => r[key]).filter((x) => x != null)), d);
  const out = {
    ...base,
    status: "ok",
    result: runs[0].result,
    artifact_bytes: fs.existsSync(v.size) ? fs.statSync(v.size).size : null,
    wall_ms: pick("wall_ms", 2),           // démarrage end-to-end (spawn + init + calcul)
    first_call_us: pick("first_call_us", 2),
    compute_ms: pick("compute_ms", 2),     // boucle de K appels (intérieur)
    per_call_ns: pick("per_call_ns", 1),   // normalisé par appel
    maxrss_kb: pick("maxrss_kb", 0),
    cold_load_ms: pick("cold_load_ms", 3) ?? null, // WASM uniquement (compile+instantiate)
    child_impl: runs[0].impl ?? null,
  };
  if (error) out.note = `échec partiel : ${error}`;
  return out;
}

const results = variants.map(runVariant);
const report = {
  date: new Date().toISOString(),
  machine: process.platform + " " + process.arch + " node " + process.version,
  workload: `fib(${N}) x K appels (médiane de ${RUNS} exécutions)`,
  results,
};
fs.writeFileSync(path.join(HERE, "results.json"), JSON.stringify(report, null, 2) + "\n");

console.log("| Implémentation | statut | artefact (o) | wall end-to-end (ms) | 1er appel (µs) | calcul K appels (ms) | par appel (ns) | RSS max (KB) |");
console.log("|---|---|---:|---:|---:|---:|---:|---:|");
for (const r of results) {
  if (r.status !== "ok") {
    console.log(`| ${r.label} | ${r.status} | - | - | - | - | - | - |`);
    if (r.detail) console.log(`| | _${r.detail}_ | | | | | | |`);
    continue;
  }
  console.log(
    `| ${r.label} | ok | ${r.artifact_bytes} | ${r.wall_ms} | ${r.first_call_us} | ${r.compute_ms} | ${r.per_call_ns} | ${r.maxrss_kb} |`
  );
}
console.log("\n→ " + path.join(HERE, "results.json"));
