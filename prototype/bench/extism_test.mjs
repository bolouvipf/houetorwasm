// Exp 021 - Comparaison avec un cadre existant : Extism (CLI 1.6.3, runtime wazero).
// Même question que l'étude §8/§C : le « binaire universel » traverse-t-il les cadres ?
// Scénarios :
//  X1  extism --version                 → 1.6.3 (outil tiers installé localement, sha256 zip vérifié à l'install)
//  X2  module HOUETOR (ABI nombre[]) sous Extism → refus « expected 2 params, but passed 0 » (ABI incompatible)
//  X3  composant WIT witcalc sous Extism → refus « invalid version header » (pas de Component Model ici)
//  X4  extplug (PDK Extism) add "2 3.5" → "5.5" = MÊME valeur que HOUETOR (le calcul passe, le contrat change)
//  X5  needy (env.host_log) sous Extism → « module[env] not instantiated » (deny-by-default aussi chez Extism)
//  X6  manifeste Extism JSON : spin + timeout_ms=500 → « Error: timeout » coupé en < 3 s (parallèle Exp 020)
//  X7  fetch SANS allowed_hosts (manifeste) → « HTTP request ... is not allowed »
//  X8  fetch AVEC allowed_hosts=127.0.0.1 (serveur local) → corps servi reçu
//  X9  hog --memory-max 16 (pages) → refus au chargement (min déclaré > limite)
//  X10 hog --memory-max 32 (pages) → 64 MiB alloués QUAND MÊME (nuance honnête : knob présent, croissance non bloquée)
//  X11 intégrité : hello/needy/witcalc intacts, serveur local fermé
// Sortie : extism_test.json. Exit 0 si tous les checks passent.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(HERE, '..');
const PLUGINS = path.join(PROTO, 'plugins');
const SAMPLE = path.join(PROTO, 'samples', 'extplug');
const EXTISM = process.env.HOUETOR_EXTISM
  ?? path.join(process.env.USERPROFILE, '.local', 'bin', 'extism', 'extism.exe');

const checks = [];
const timings = {};
let allOk = true;
const note = (id, pass, detail) => {
  checks.push({ id, pass, ...(detail ? { detail: String(detail).slice(0, 300) } : {}) });
  if (!pass) allOk = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`);
};

// spawn ASYNCHRONE : le serveur HTTP local vit dans ce même process (cf. registry_test.mjs)
function extism(args, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const ch = spawn(EXTISM, args, { windowsHide: true });
    let out = '';
    let err = '';
    const kill = setTimeout(() => ch.kill(), timeoutMs);
    ch.stdout.on('data', (d) => (out += d));
    ch.stderr.on('data', (d) => (err += d));
    ch.on('close', (code) => {
      clearTimeout(kill);
      resolve({ status: code, ms: Number(process.hrtime.bigint() - t0) / 1e6, out: out + err });
    });
    ch.on('error', (e) => {
      clearTimeout(kill);
      resolve({ status: -1, ms: 0, out: String(e) });
    });
  });
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'houetor-extism-'));
const writeManifest = (name, obj) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
};

// --- X1 : outil présent ---
{
  if (!fs.existsSync(EXTISM)) {
    note('X1 extism installé', false, `introuvable : ${EXTISM} — installer : https://github.com/extism/cli/releases (v1.6.3)`);
    process.exit(1);
  }
  const v = await extism(['--version']);
  note('X1 extism --version', v.status === 0 && /1\.6\.3/.test(v.out), v.out.trim());
  timings.version_ms = +v.ms.toFixed(1);
}

const EXT_WASM = path.join(SAMPLE, 'extplug.wasm');
if (!fs.existsSync(EXT_WASM)) {
  note('X0 extplug.wasm compilé', false, `absent : ${EXT_WASM} — cargo build --release --target wasm32-unknown-unknown`);
  process.exit(1);
}

// --- X2/X3 : nos binaires sous Extism (contrats non Extism) ---
{
  const r = await extism(['call', path.join(PLUGINS, 'hello', 'hello.wasm'), 'add', '-i', '2 3.5']);
  note('X2 module HOUETOR (ABI nombre[]) → refus ABI Extism',
    r.status !== 0 && /expected 2 params/.test(r.out), r.out.trim().split(/\r?\n/).find((l) => /Error|error/.test(l)));

  const c = await extism(['call', path.join(PLUGINS, 'witcalc', 'witcalc.wasm'), 'add', '-i', '2 3.5']);
  note('X3 composant WIT → refus (pas de Component Model dans ce CLI)',
    c.status !== 0 && /invalid version header/.test(c.out), c.out.trim().split(/\r?\n/).find((l) => /Error|error/.test(l)));
}

// --- X4 : plugin Extism ABI → même valeur que HOUETOR ---
{
  const r = await extism(['call', EXT_WASM, 'add', '-i', '2 3.5']);
  note('X4 extplug (PDK Extism) add "2 3.5" → "5.5" (même valeur que HOUETOR)',
    r.status === 0 && r.out.trim() === '5.5', `out=${JSON.stringify(r.out.trim())} ${Math.round(r.ms)}ms`);
  timings.add_ms = +r.ms.toFixed(1);
}

// --- X5 : import hôte inconnu → refus (deny-by-default comparé) ---
{
  const r = await extism(['call', path.join(PLUGINS, 'needy', 'needy.wasm'), 'do_log', '-i', 'hello']);
  note('X5 needy (env.host_log) → « module[env] not instantiated » (deny Extism)',
    r.status !== 0 && /module\[env\] not instantiated/.test(r.out), r.out.trim().split(/\r?\n/).find((l) => /Error|error/.test(l)));
}

// --- X6 : manifeste Extism (timeout_ms) → spin coupé ---
{
  const man = writeManifest('spin.json', {
    wasm: [{ name: 'main', path: EXT_WASM }],
    timeout_ms: 500,
  });
  const r = await extism(['call', '-m', man, 'spin'], 15_000);
  timings.spin_timeout_ms = +r.ms.toFixed(1);
  note('X6 manifeste Extism timeout_ms=500 → spin coupé « Error: timeout » en < 3 s',
    r.status !== 0 && /timeout/i.test(r.out) && r.ms < 3000, `exit=${r.status} ${Math.round(r.ms)}ms`);
}

// --- X7/X8 : allowed_hosts (deny puis grant via serveur local) ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('EXTISM-LOCAL-OK');
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const PORT = server.address().port;
const URL = `http://127.0.0.1:${PORT}/probe`;

{
  const manDenied = writeManifest('http-denied.json', {
    wasm: [{ name: 'main', path: EXT_WASM }],
    allowed_hosts: [],
  });
  const r = await extism(['call', '-m', manDenied, 'fetch', '-i', URL], 15_000);
  note('X7 manifeste allowed_hosts=[] → HTTP refusé',
    r.status !== 0 && /not allowed/.test(r.out), r.out.trim().split(/\r?\n/).find((l) => /not allowed|Error/.test(l)));

  const manOk = writeManifest('http-ok.json', {
    wasm: [{ name: 'main', path: EXT_WASM }],
    allowed_hosts: ['127.0.0.1'],
  });
  const r2 = await extism(['call', '-m', manOk, 'fetch', '-i', URL], 15_000);
  note('X8 allowed_hosts=127.0.0.1 → corps servi local reçu',
    r2.status === 0 && r2.out.includes('EXTISM-LOCAL-OK'), `out=${JSON.stringify(r2.out.trim().slice(0, 60))}`);
}

// --- X9/X10 : memory-max (pages de 64 Ki) ---
{
  const r = await extism(['call', EXT_WASM, 'hog', '--memory-max', '16']);
  note('X9 hog --memory-max 16 → refus au chargement (min déclaré 17 pages)',
    r.status !== 0 && /over limit/.test(r.out), r.out.trim().split(/\r?\n/).find((l) => /over limit|Error/.test(l)));

  const r2 = await extism(['call', EXT_WASM, 'hog', '--memory-max', '32']);
  const grew = /67108864 octets touches/.test(r2.out);
  note('X10 hog --memory-max 32 (2 MiB) → 64 MiB alloués quand même (nuance : limite non bloquante)',
    r2.status === 0 && grew, `exit=${r2.status} out=${JSON.stringify(r2.out.trim().slice(0, 60))}`);
}

// --- X11 : nettoyage / intégrité ---
{
  await new Promise((res) => server.close(res));
  const counts = {};
  for (const name of ['hello', 'needy', 'witcalc']) {
    const r = spawnSync(process.execPath, [path.join(PROTO, 'host', 'host.mjs'), 'info', name], { encoding: 'utf8' });
    counts[name] = r.status === 0;
  }
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-') || d.startsWith('.archive-tmp-'));
  note('X11 serveur fermé + plugins intacts', Object.values(counts).every(Boolean) && !staging,
    `${JSON.stringify(counts)} staging=${staging}`);
}
fs.rmSync(TMP, { recursive: true, force: true });

const out = {
  date: new Date().toISOString(),
  machine: `${process.platform} ${process.arch} ${process.version}`,
  comparaison: 'Extism CLI 1.6.3 (runtime wazero) vs HOUETOR Plugin Host (Node in-process + wasmtime 49.0.2)',
  contrats: {
    extism: ['manifeste JSON {wasm, allowed_hosts, allowed_paths, timeout_ms, memory.max_pages, config}', 'ABI PDK Extism (extism:host/env)', 'WASI optionnel (--wasi + allowed_paths)'],
    houetor: ['manifeste JSON {name, version, type, exports, permissions, sha256, manifest.sig}', 'ABI module core nombre[] ou composant WIT/WAVE', 'WASI + HOUETOR_PREOPENS + HOUETOR_FUEL/HOUETOR_TIMEOUT'],
  },
  timings_ms: timings,
  checks,
  all_checks_pass: allOk,
};
fs.writeFileSync(path.join(HERE, 'extism_test.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks — tous verts : ${allOk}`);
console.log(`-> ${path.join(HERE, 'extism_test.json')}`);
process.exit(allOk ? 0 : 1);
