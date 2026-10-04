// Exp 016 — Provenance Ed25519 : signature de manifeste (manifest.sig) + clés de confiance.
// HOUETOR_TRUST_KEYS = clé(s) publique(s) PEM de confiance (séparées , ou ;).
// Scénarios :
//  K1  host keygen → paire ed25519 (priv.pem + pub.pem)
//  D1  install-url SANS manifest.sig → refusé (signature obligatoire à distance)
//  D2  install-url AVEC sig valide + trust → installé + appel OK
//  D3  manifeste MODIFIÉ après signature → refusé (signature invalide)
//  D4  signé par une clé ÉTRANGÈRE (trust = autre clé) → refusé
//  L1  install local d'un dossier signé valide → OK
//  L2  install local sig invalide → refusé avant copie
//  A1  plugin signé installé, appel SANS HOUETOR_TRUST_KEYS → refusé (ancrage manquant)
//  C1  plugin sans sig (hello) → toujours chargeable (compat)
// Sortie : sig_test.json. Exit 0 si tous les checks passent.

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
const NAME = 'sigprobe';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const HELLO_SHA = sha256(fs.readFileSync(HELLO_WASM));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'houetor-sig-'));
const REG = path.join(TMP, 'reg');
const KEYS = path.join(TMP, 'keys');
fs.mkdirSync(REG, { recursive: true });
fs.mkdirSync(KEYS, { recursive: true });

const checks = [];
let allOk = true;
const note = (id, pass, detail) => {
  checks.push({ id, pass, ...(detail ? { detail } : {}) });
  if (!pass) allOk = false;
};

// hostCmd avec env HOUETOR_TRUST_KEYS configurable (null = sans ancrage)
const hostCmd = (args, trustKeys = PUB) =>
  new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const env = { ...process.env };
    if (trustKeys) env.HOUETOR_TRUST_KEYS = trustKeys;
    else delete env.HOUETOR_TRUST_KEYS;
    const ch = spawn(process.execPath, [HOST, ...args], { windowsHide: true, env });
    let out = '';
    ch.stdout.on('data', (d) => (out += d));
    ch.stderr.on('data', (d) => (out += d));
    ch.on('close', (code) => resolve({ ms: Number(process.hrtime.bigint() - t0) / 1e6, status: code, out }));
  });

const manifest = (version, name = NAME) => ({
  name,
  version,
  wasm: `${NAME}.wasm`,
  description: 'Plugin temoin signature (Exp 016)',
  exports: ['add', 'fibonacci', 'plugin_version'],
  permissions: [],
  entry_abi: 'core-wasm-f64-f64',
  sha256: HELLO_SHA,
});

const writePlugin = (dir, mf) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(mf, null, 2));
  fs.copyFileSync(HELLO_WASM, path.join(dir, `${NAME}.wasm`));
};
const signWith = (dir, privPem) => {
  const sig = crypto.sign(null, fs.readFileSync(path.join(dir, 'manifest.json')), crypto.createPrivateKey(fs.readFileSync(privPem)));
  fs.writeFileSync(path.join(dir, 'manifest.sig'), JSON.stringify({ alg: 'ed25519', sig: sig.toString('base64') }, null, 2) + '\n');
};

// --- K1 : keygen via le host lui-même ---
{
  const priv = path.join(KEYS, 'priv.pem');
  const pub = path.join(KEYS, 'pub.pem');
  const r = await hostCmd(['keygen', priv, pub], null);
  const ok =
    r.status === 0 &&
    fs.existsSync(priv) && fs.readFileSync(priv, 'utf8').includes('PRIVATE KEY') &&
    fs.existsSync(pub) && fs.readFileSync(pub, 'utf8').includes('PUBLIC KEY');
  note('K1 host keygen ed25519', ok, r.out.trim());
}
const PUB = path.join(KEYS, 'pub.pem');
const PRIV = path.join(KEYS, 'priv.pem');
// clé étrangère (non approuvée)
{
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(KEYS, 'stranger-priv.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.writeFileSync(path.join(KEYS, 'stranger-pub.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
}

// variantes du registre
const dirSig = path.join(REG, NAME, '1.0.0');           // sig valide
const dirNosig = path.join(REG, `${NAME}-nosig`, '1.0.0'); // pas de sig
const dirTamper = path.join(REG, `${NAME}-tamper`, '1.0.0'); // sig puis modification
const dirEvil = path.join(REG, `${NAME}-evil`, '1.0.0'); // sig par clé étrangère
writePlugin(dirSig, manifest('1.0.0'));
signWith(dirSig, PRIV);
writePlugin(dirNosig, manifest('1.0.0', `${NAME}-nosig`)); // PAS de signature
writePlugin(dirTamper, manifest('1.0.0', `${NAME}-tamper`));
signWith(dirTamper, PRIV);
// modification APRÈS signature → le lien octets↔signature casse
const tamperedMf = JSON.parse(fs.readFileSync(path.join(dirTamper, 'manifest.json'), 'utf8'));
tamperedMf.description = 'MODIFIE-APRES-SIGNATURE';
fs.writeFileSync(path.join(dirTamper, 'manifest.json'), JSON.stringify(tamperedMf, null, 2));
writePlugin(dirEvil, manifest('1.0.0', `${NAME}-evil`));
signWith(dirEvil, path.join(KEYS, 'stranger-priv.pem'));

// --- serveur HTTP local ---
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
const BASE = `http://127.0.0.1:${server.address().port}`;

// nettoyage préalable
await hostCmd(['remove', NAME]);
await hostCmd(['remove', `${NAME}-tamper`]);
await hostCmd(['remove', `${NAME}-evil`]);

// D1 — distant sans manifest.sig → refusé
{
  const r = await hostCmd(['install-url', `${BASE}/${NAME}-nosig/1.0.0/`]);
  const installed = fs.existsSync(path.join(PLUGINS, `${NAME}-nosig`));
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-'));
  note('D1 distant sans manifest.sig refusé', r.status !== 0 && /manifest\.sig/.test(r.out) && !installed && !staging, r.out.trim().split('\n').pop());
}

// D2 — sig valide + trust → installé + appel OK
{
  const r = await hostCmd(['install-url', `${BASE}/${NAME}/1.0.0/`]);
  note('D2 install-url signé accepté', r.status === 0 && r.out.includes(`${NAME}@1.0.0`), r.out.trim().replace(/\n/g, ' | '));
  const call = await hostCmd(['run', NAME, 'fibonacci', '10']);
  let result = null;
  try { result = JSON.parse(call.out).result; } catch {}
  note('D2 appel fibonacci(10)=55 (sig + sha vérifiés)', call.status === 0 && result === 55, `result=${result}`);
}

// D3 — manifeste modifié après signature → refusé
{
  const r = await hostCmd(['install-url', `${BASE}/${NAME}-tamper/1.0.0/`]);
  const installed = fs.existsSync(path.join(PLUGINS, `${NAME}-tamper`));
  note('D3 manifeste modifié après sig → INVALIDE', r.status !== 0 && /INVALIDE/.test(r.out) && !installed, r.out.trim().split('\n').pop());
}

// D4 — clé étrangère (non approuvée) → refusé
{
  const r = await hostCmd(['install-url', `${BASE}/${NAME}-evil/1.0.0/`]);
  const installed = fs.existsSync(path.join(PLUGINS, `${NAME}-evil`));
  note('D4 clé étrangère → INVALIDE', r.status !== 0 && /INVALIDE/.test(r.out) && !installed, r.out.trim().split('\n').pop());
}

// L1 — install local signé valide
{
  const src = path.join(TMP, 'local-ok');
  writePlugin(src, manifest('1.0.0', `${NAME}-local`));
  signWith(src, PRIV);
  const r = await hostCmd(['install', src]);
  note('L1 install local signé → OK', r.status === 0 && r.out.includes('installé'), r.out.trim().replace(/\n/g, ' | '));
}

// L2 — install local sig invalide (manifeste retouché) → refusé avant copie
{
  const src = path.join(TMP, 'local-bad');
  writePlugin(src, manifest('1.0.0', `${NAME}-localbad`));
  signWith(src, PRIV);
  const mf = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
  mf.description = 'MODIFIE';
  fs.writeFileSync(path.join(src, 'manifest.json'), JSON.stringify(mf, null, 2));
  const r = await hostCmd(['install', src]);
  const installed = fs.existsSync(path.join(PLUGINS, `${NAME}-localbad`));
  note('L2 install local sig invalide refusé', r.status !== 0 && /INVALIDE/.test(r.out) && !installed, r.out.trim().split('\n').pop());
}

// A1 — plugin signé installé, appel SANS clé de confiance → refusé (fail loud)
{
  const r = await hostCmd(['run', NAME, 'fibonacci', '10'], null);
  note('A1 sans HOUETOR_TRUST_KEYS → refusé (ancrage manquant)', r.status !== 0 && /AUCUNE clé de confiance/.test(r.out), r.out.trim().split('\n').pop());
}

// C1 — compat : plugin SANS signature (hello) reste chargeable
{
  const r = await hostCmd(['run', 'hello', 'add', '2', '3.5']);
  let result = null;
  try { result = JSON.parse(r.out).result; } catch {}
  note('C1 plugin sans sig (hello) → 5.5', r.status === 0 && result === 5.5, `result=${result}`);
}

// nettoyage
await hostCmd(['remove', NAME]);
await hostCmd(['remove', `${NAME}-local`]);
{
  const gone = ![NAME, `${NAME}-local`, `${NAME}-tamper`, `${NAME}-evil`, `${NAME}-nosig`, `${NAME}-localbad`].some(
    (n) => fs.existsSync(path.join(PLUGINS, n))
  );
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-') || d.startsWith('.archive-tmp-'));
  const helloOk = fs.existsSync(path.join(PLUGINS, 'hello', 'manifest.json'));
  note('nettoyage complet (témoin + staging)', gone && !staging, `gone=${gone} staging=${staging}`);
  note('hello/needy intacts', helloOk, `hello=${helloOk}`);
}

server.close();
fs.rmSync(TMP, { recursive: true, force: true });

const out = {
  date: new Date().toISOString(),
  machine: `win32 x64 ${process.version}`,
  scheme: 'Ed25519, manifest.sig = {alg, sig:base64} signant les octets bruts de manifest.json ; confiance = HOUETOR_TRUST_KEYS (PEM)',
  checks,
  all_checks_pass: allOk,
};
fs.writeFileSync(path.join(HERE, 'sig_test.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) console.log(`${c.pass ? '✅' : '❌'} ${c.id}${c.detail ? ' — ' + c.detail : ''}`);
console.log(`\nTous les checks passent : ${allOk}`);
console.log(`-> ${path.join(HERE, 'sig_test.json')}`);
process.exit(allOk ? 0 : 1);
