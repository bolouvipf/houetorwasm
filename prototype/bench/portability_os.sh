#!/usr/bin/env bash
# Exp 010 — Portabilité MULTI-OS : le MÊME binaire WASM (p1) exécuté sous Linux/WSL2.
# Médiane de BENCH_RUNS exécutions par jambe ; contrôle strict result == 1134903170.
# Sortie stdout : une ligne JSON par jambe (+ meta). Exit 0 si tous s'accordent.
#
# Prérequis (une fois) — voir phase3_measures.md §7 :
#   mkdir -p ~/tools && cd ~/tools
#   curl -sL https://github.com/bytecodealliance/wasmtime/releases/download/v49.0.2/wasmtime-v49.0.2-x86_64-linux.tar.xz | tar xJ
#   curl -sL -o wazero.zip https://github.com/tetratelabs/wazero/releases/download/v1.12.0/wazero_1.12.0_linux_amd64.zip && unzip -o wazero.zip && rm wazero.zip
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WASM="$HERE/fib_wasi/target/wasm32-wasip1/release/fib-wasi.wasm"
K="${BENCH_K:-10000000}"
N=45
RUNS="${BENCH_RUNS:-5}"
EXPECT=1134903170

WT="$(ls -d "$HOME"/tools/wasmtime-*-x86_64-linux/wasmtime 2>/dev/null | head -1 || true)"
WZ="$HOME/tools/wazero"
[ -f "$WASM" ]  || { echo "FAIL: wasm absent: $WASM" >&2; exit 1; }
[ -n "$WT" ]    || { echo "FAIL: wasmtime linux absent dans ~/tools (voir en-tête)" >&2; exit 1; }
[ -x "$WZ" ]    || { echo "FAIL: wazero absent dans ~/tools (voir en-tête)" >&2; exit 1; }

median() { printf '%s\n' "$@" | sort -n | awk '{a[NR]=$1} END{if(NR%2) print a[(NR+1)/2]; else printf "%.1f", (a[NR/2]+a[NR/2+1])/2}'; }

run_leg() {
  local label="$1"; shift
  local vals=() i out res ns
  for i in $(seq "$RUNS"); do
    out="$("$@" 2>/dev/null | grep '^{' | tail -1 || true)"
    [ -n "$out" ] || { echo "FAIL: $label — aucune sortie JSON" >&2; exit 1; }
    res=$(printf '%s' "$out" | sed -n 's/.*"result":"\([0-9]*\)".*/\1/p')
    [ "$res" = "$EXPECT" ] || { echo "FAIL: $label result=$res (attendu $EXPECT)" >&2; exit 1; }
    ns=$(printf '%s' "$out" | sed -n 's/.*"per_call_ns":\([0-9.]*\).*/\1/p')
    vals+=("$ns")
  done
  local med; med="$(median "${vals[@]}")"
  printf '{"label":"%s","per_call_ns":%s,"runs":%d,"k":%d,"n":%d,"result":"%s"}\n' \
    "$label" "$med" "$RUNS" "$K" "$N" "$EXPECT"
}

echo "{\"os\":\"$(uname -srm)\",\"kernel\":\"$(uname -r)\",\"cores\":$(nproc),\"k\":$K,\"n\":$N,\"runs\":$RUNS}"

run_leg "wasmtime (Cranelift) — Linux x86_64, module WASI p1" "$WT" run "$WASM" "$K" "$N" wasmtime-linux
run_leg "wazero (moteur Go) — Linux x86_64, module WASI p1"   "$WZ" run "$WASM" "$K" "$N" wazero-linux
if command -v node >/dev/null 2>&1; then
  run_leg "node:wasi (V8) — Linux, module WASI p1" \
    node --experimental-wasi-unstable-preview1 "$HERE/node_wasi.mjs" "$WASM" "$K" "$N" node-wasi-linux
fi
echo '{"all_runtimes_agree":true}'
