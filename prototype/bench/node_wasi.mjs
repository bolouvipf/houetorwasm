// Exécuteur node:wasi (V8 + WASI preview1 intégré) — Exp 007/011.
// Usage : node --experimental-wasi-unstable-preview1 node_wasi.mjs <wasm> [args...]
//   args restants = argv du guest (ex. fib : k n label ; filecap : chemin cible).
// Env optionnel : WASI_PREOPENS = JSON {"<guestPath>":"<hostPath>"} (capabilities).
import fs from 'node:fs';
import { WASI } from 'node:wasi';

const [wasmPath, ...guestArgs] = process.argv.slice(2);
const preopens = process.env.WASI_PREOPENS ? JSON.parse(process.env.WASI_PREOPENS) : undefined;

const wasi = new WASI({
  version: 'preview1',
  args: ['wasm', ...guestArgs],
  returnOnExit: true,
  ...(preopens ? { preopens } : {}),
});
const bytes = fs.readFileSync(wasmPath);
const { instance } = await WebAssembly.instantiate(bytes, {
  wasi_snapshot_preview1: wasi.wasiImport,
});
wasi.start(instance);
