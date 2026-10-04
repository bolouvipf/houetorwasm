// Exécuteur node:wasi (V8 + WASI preview1 intégré) pour l'Exp 007 (portabilité).
// Usage: node --experimental-wasi-unstable-preview1 node_wasi.mjs <wasm> <k> <n> <label>
import fs from 'node:fs';
import { WASI } from 'node:wasi';

const [wasmPath, k, n, label] = process.argv.slice(2);
const wasi = new WASI({
  version: 'preview1',
  args: ['fib', String(k ?? 100000), String(n ?? 45), label ?? 'node-wasi'],
  returnOnExit: true,
});
const bytes = fs.readFileSync(wasmPath);
const { instance } = await WebAssembly.instantiate(bytes, {
  wasi_snapshot_preview1: wasi.wasiImport,
});
wasi.start(instance);
