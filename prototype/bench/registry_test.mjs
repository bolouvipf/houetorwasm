// Exp 013+014 — Distribution : registre local (découverte) + installation depuis HTTP + épinglage sha256.
// Layout registre : <reg>/<nom>/<version>/{manifest.json,wasm}
// Scénarios (tests fonctionnels, durée ms reportée) :
//  R1  host registry <reg>          → liste regprobe@1.0.0 et @1.0.1
//  R2  install-url (HTTP) v1.0.0    → installé + appel fonctionnel (fibonacci(10)=55)
//  R3  install-url (HTTP) v1.0.1    → mise à jour + archive .history/1.0.0
//  R4  install-url même version     → refusé (doublon)
//  R5  manifeste distant corrompu   → refusé AVANT installation (rien n'est laissé)
//  R6  fichier wasm manquant (404)  → refusé, staging nettoyé
//  I1  manifeste distant sans sha256 → refusé (épinglage obligatoire, Exp 014)
//  I3  sha256 faux (contenu altéré)  → refusé, rien installé
//  I4  wasm altéré sur disque après install → `run` refusé (loadManifest vérifie)
//  I5  plugins sans sha256 (compat)  → hello reste chargeable
// Sortie : registry_test.json (preuve brute). Exit 0 si tous les checks passent.

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOST = path.join(HERE, '..', 'host', 'host.mjs');
const PLUGINS = path.join(HERE, '..', 'plugins');
const HELLO_WASM = path.join(PLUGINS, 'hello', 'hello.wasm');
const NAME = 'regprobe';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const HELLO_SHA = sha256(fs.readFileSync(HELLO_WASM));

const REG = fs.mkdtempSync(path.join(os.tmpdir(), 'houetor-reg-'));
const checks = [];
const timings = {};
let allOk = true;
const note = (id, pass, detail) => {
  checks.push({ id, pass, ...(detail ? { detail } : {}) });
  if (!pass) allOk = false;
};

// NB : spawn ASYNCHRONE — spawnSync bloquerait la boucle d'événements et le
// serveur HTTP local (même process) provoquerait un deadlock.
const hostCmd = (...args) =>
  new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const ch = spawn(process.execPath, [HOST, ...args], { windowsHide: true });
    let out = '';
    ch.stdout.on('data', (d) => (out += d));
    ch.stderr.on('data', (d) => (out += d));
    ch.on('close', (code) => resolve({ ms: Number(process.hrtime.bigint() - t0) / 1e6, status: code, out }));
  });

const manifest = (version, { sha, name = NAME } = {}) => ({
  name,
  version,
  wasm: `${NAME}.wasm`,
  description: 'Plugin temoin registre (Exp 013+014)',
  exports: ['add', 'fibonacci', 'plugin_version'],
  permissions: [],
  entry_abi: 'core-wasm-f64-f64',
  ...(sha !== undefined && { sha256: sha }),
});

// --- construction du registre local ---
for (const v of ['1.0.0', '1.0.1']) {
  const dir = path.join(REG, NAME, v);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest(v, { sha: HELLO_SHA }), null, 2));
  fs.copyFileSync(HELLO_WASM, path.join(dir, `${NAME}.wasm`));
}
// variante corrompue (exports manquant) — test R5 (name volontairement = NAME pour prouver qu'il n'écrase rien)
const corruptDir = path.join(REG, `${NAME}-corrupt`, '9.9.9');
fs.mkdirSync(corruptDir, { recursive: true });
fs.writeFileSync(path.join(corruptDir, 'manifest.json'), JSON.stringify({ name: NAME, version: '9.9.9', wasm: 'x.wasm' }));
fs.copyFileSync(HELLO_WASM, path.join(corruptDir, 'x.wasm'));
// variante 404 (manifeste ok + sha256 valide, wasm absent) — test R6
const notfoundDir = path.join(REG, `${NAME}-404`, '1.0.0');
fs.mkdirSync(notfoundDir, { recursive: true });
fs.writeFileSync(path.join(notfoundDir, 'manifest.json'), JSON.stringify(manifest('1.0.0', { sha: HELLO_SHA, name: `${NAME}-404` })));
// variante sans sha256 — test I1 (épinglage obligatoire pour une source distante)
const noshaDir = path.join(REG, `${NAME}-nosha`, '1.0.0');
fs.mkdirSync(noshaDir, { recursive: true });
fs.writeFileSync(path.join(noshaDir, 'manifest.json'), JSON.stringify(manifest('1.0.0', { name: `${NAME}-nosha` }), null, 2));
fs.copyFileSync(HELLO_WASM, path.join(noshaDir, `${NAME}.wasm`));
// variante sha256 faux — test I3 (contenu altéré côté distant)
const badshaDir = path.join(REG, `${NAME}-badsha`, '1.0.0');
fs.mkdirSync(badshaDir, { recursive: true });
fs.writeFileSync(path.join(badshaDir, 'manifest.json'), JSON.stringify(manifest('1.0.0', { sha: '0'.repeat(64), name: `${NAME}-badsha` }), null, 2));
fs.copyFileSync(HELLO_WASM, path.join(badshaDir, `${NAME}.wasm`));

// --- serveur HTTP local = « registre distant » ---
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.replace(/^\/+/, ''));
  const file = path.join(REG, rel);
  if (!file.startsWith(REG) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': rel.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;

// nettoyage préalable (staging résiduel d'un run précédent / interrompu)
for (const d of fs.readdirSync(PLUGINS)) {
  if (d.startsWith('.staging-') || d.startsWith('.archive-tmp-')) fs.rmSync(path.join(PLUGINS, d), { recursive: true, force: true });
}
await hostCmd('remove', NAME);

// R1 — découverte registry local
{
  const r = await hostCmd('registry', REG);
  const ok = r.status === 0 && r.out.includes(`${NAME}@1.0.0`) && r.out.includes(`${NAME}@1.0.1`);
  note('R1 registry liste les 2 versions', ok, r.out.trim().replace(/\n/g, ' | '));
}

// R2 — install-url HTTP v1.0.0 + appel fonctionnel
{
  const r = await hostCmd('install-url', `${BASE}/${NAME}/1.0.0/`);
  timings.install_v1 = +r.ms.toFixed(1);
  const installed = r.status === 0 && r.out.includes(`${NAME}@1.0.0`);
  note('R2 install-url 1.0.0', installed, r.out.trim().replace(/\n/g, ' | '));
  const call = await hostCmd('run', NAME, 'fibonacci', '10');
  let result = null;
  try { result = JSON.parse(call.out).result; } catch {}
  note('R2 appel fibonacci(10)=55', call.status === 0 && result === 55, `result=${result}`);
}

// R3 — mise à jour à distance v1.0.1 + archive
{
  const r = await hostCmd('install-url', `${BASE}/${NAME}/1.0.1/`);
  timings.install_v2 = +r.ms.toFixed(1);
  const hist = fs.existsSync(path.join(PLUGINS, NAME, '.history', '1.0.0'));
  const cur = fs.existsSync(path.join(PLUGINS, NAME, 'manifest.json'))
    ? JSON.parse(fs.readFileSync(path.join(PLUGINS, NAME, 'manifest.json'), 'utf8')).version
    : null;
  note('R3 mise à jour 1.0.1 + .history/1.0.0', r.status === 0 && hist && cur === '1.0.1', `version=${cur} history=${hist}`);
}

// R4 — doublon refusé
{
  const r = await hostCmd('install-url', `${BASE}/${NAME}/1.0.1/`);
  note('R4 doublon refusé', r.status !== 0 && r.out.includes('déjà installée'), r.out.trim().split('\n').pop());
}

// R5 — manifeste corrompu refusé AVANT installation
{
  const r = await hostCmd('install-url', `${BASE}/${NAME}-corrupt/9.9.9/`);
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-'));
  note('R5 manifeste corrompu refusé (rien installé)', r.status !== 0 && r.out.includes('exports') && !staging, r.out.trim().split('\n').pop());
  const cur = JSON.parse(fs.readFileSync(path.join(PLUGINS, NAME, 'manifest.json'), 'utf8')).version;
  note('R5 plugin courant intact', cur === '1.0.1', `version=${cur}`);
}

// R6 — wasm 404 refusé + staging nettoyé
{
  const r = await hostCmd('install-url', `${BASE}/${NAME}-404/1.0.0/`);
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-'));
  note('R6 wasm 404 refusé, staging nettoyé', r.status !== 0 && r.out.includes('HTTP 404') && !staging, r.out.trim().split('\n').pop());
}

// I1 — distant sans sha256 → refusé (épinglage obligatoire, Exp 014)
{
  const r = await hostCmd('install-url', `${BASE}/${NAME}-nosha/1.0.0/`);
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-'));
  const installed = fs.existsSync(path.join(PLUGINS, `${NAME}-nosha`));
  note('I1 distant sans sha256 refusé', r.status !== 0 && r.out.includes('sha256') && !staging && !installed, r.out.trim().split('\n').pop());
}

// I3 — sha256 faux → refusé, rien installé
{
  const r = await hostCmd('install-url', `${BASE}/${NAME}-badsha/1.0.0/`);
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-'));
  const installed = fs.existsSync(path.join(PLUGINS, `${NAME}-badsha`));
  note('I3 sha256 faux refusé, rien installé', r.status !== 0 && r.out.includes('INCONGRU') && !staging && !installed, r.out.trim().split('\n').pop());
}

// I4 — wasm altéré APRÈS installation → run refusé (loadManifest re-vérifie)
{
  const wasmPath = path.join(PLUGINS, NAME, `${NAME}.wasm`);
  const orig = fs.readFileSync(wasmPath);
  const tampered = Buffer.from(orig);
  tampered[tampered.length - 1] ^= 0xff; // flip 1 octet
  fs.writeFileSync(wasmPath, tampered);
  const r = await hostCmd('run', NAME, 'fibonacci', '10');
  const refused = r.status !== 0 && r.out.includes('INCONGRU');
  fs.writeFileSync(wasmPath, orig); // restaure pour la suite
  note('I4 wasm altéré sur disque → run refusé', refused, r.out.trim().split('\n').pop());
}

// I5 — compat : plugins SANS sha256 restent chargeables (local)
{
  const r = await hostCmd('run', 'hello', 'add', '2', '3.5');
  let result = null;
  try { result = JSON.parse(r.out).result; } catch {}
  note('I5 plugin sans sha256 chargeable (hello 2+3.5=5.5)', r.status === 0 && result === 5.5, `result=${result}`);
}

// nettoyage final : le témoin ne reste pas installé ; hello/needy intacts
await hostCmd('remove', NAME);
{
  const gone = !fs.existsSync(path.join(PLUGINS, NAME));
  const helloOk = JSON.parse(fs.readFileSync(path.join(PLUGINS, 'hello', 'manifest.json'), 'utf8')).version === '1.0.1';
  const needyOk = fs.existsSync(path.join(PLUGINS, 'needy', 'manifest.json'));
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-') || d.startsWith('.archive-tmp-'));
  note('nettoyage : témoin retiré', gone, `gone=${gone}`);
  note('hello/needy intacts', helloOk && needyOk, `hello=${helloOk} needy=${needyOk}`);
  note('aucun staging résiduel', !staging, `staging=${staging}`);
}

server.close();
fs.rmSync(REG, { recursive: true, force: true });

const out = {
  date: new Date().toISOString(),
  machine: `win32 x64 ${process.version}`,
  registry_layout: '<reg>/<nom>/<version>/{manifest.json,wasm}',
  base_url: BASE.replace(/:\d+/, ':<port>'),
  timings_ms: timings,
  checks,
  all_checks_pass: allOk,
};
fs.writeFileSync(path.join(HERE, 'registry_test.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) console.log(`${c.pass ? '✅' : '❌'} ${c.id}${c.detail ? ' — ' + c.detail : ''}`);
console.log(`\nTous les checks passent : ${allOk}`);
console.log(`-> ${path.join(HERE, 'registry_test.json')}`);
process.exit(allOk ? 0 : 1);
