// Exp 018+019 - Composants WIT : typage fort (WAVE), capabilities lisibles dans le binaire,
//   et pont MCP à types nommés (fin du typage « number[] » de la Phase 4).
// Scénarios (host, Exp 018) :
//  W1  host wit witcalc          → WIT lue DANS LE BINAIRE (export houetor:calc/calc@0.1.0)
//  W2  host types witcalc        → signatures f64/u32/string lues dans le binaire
//  W3  surface de capabilities   → import wasi:filesystem/* visible AVANT exécution
//  W4  run add(2, 3.5)           → 5.5 (f64)
//  W5  run fibonacci(45)         → 1134903170 (identique aux 7 combinaisons module/OS/moteur)
//  W6  run greet(HOUETOR)        → chaîne typée (WAVE), pas un nombre
//  W7  add("x", 1)               → refusé par le typage WAVE (avant exécution)
//  W8  add(1)                    → refusé : arité contrôlée par la signature WIT
//  W9  read-file sans montage    → err os 44 (deny-by-default au niveau WASI)
//  W10 read-file + HOUETOR_PREOPENS → ok("BONJOUR-WASM-CAP") (accord explicite)
//  W11 escape data/../secret.txt → err os 63, contenu SECRET non divulgué
//  W12 manifeste sans permission  → refus au chargement (deny-by-default STATIQUE)
// Scénarios (bridge MCP, Exp 019) :
//  B1  tools/list witcalc_add    → inputSchema nommé {a: number, b: number}, required [a,b]
//  B2  tools/call witcalc_greet  → arguments nommés {"name": "..."} → résultat chaîne
//  B3  tools/call witcalc_add    → {"a":2,"b":3.5} → 5.5
//  B4  paramètre manquant        → refus explicite côté bridge
//  B5  type invalide côté host   → isError + message « type WIT »
//  B6  régression module core    → hello_add garde le schéma legacy args[]
// Sortie : component_test.json. Exit 0 si tous les checks passent.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // prototype/bench
const PROTO = path.resolve(HERE, '..');
const HOST = path.join(PROTO, 'host', 'host.mjs');
const BRIDGE = path.join(PROTO, 'mcp', 'bridge.mjs');
const SAMPLE = path.join(PROTO, 'samples', 'witcalc');
const PLUGINS = path.join(PROTO, 'plugins');
const CAPDATA = path.join(HERE, 'capdata');
const SECRET = fs.readFileSync(path.join(HERE, 'secret.txt'), 'utf8').trim();

const checks = [];
const timings = {};
let allOk = true;
const note = (id, pass, detail) => {
  checks.push({ id, pass, ...(detail ? { detail: String(detail).slice(0, 300) } : {}) });
  if (!pass) allOk = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`);
};

function hostCmd(args, env = {}) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const ch = spawn(process.execPath, [HOST, ...args], {
      windowsHide: true,
      env: { ...process.env, ...env },
    });
    let out = '';
    ch.stdout.on('data', (d) => (out += d));
    ch.stderr.on('data', (d) => (out += d));
    ch.on('close', (code) => resolve({ ms: Number(process.hrtime.bigint() - t0) / 1e6, status: code, out }));
  });
}

// client MCP minimal (mêmes principes que policy_test.mjs)
function makeBridge() {
  const child = spawn(process.execPath, [BRIDGE], { stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '';
  const pending = new Map();
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p(msg);
      }
    }
  });
  let seq = 0;
  return {
    request: (method, params) =>
      new Promise((resolve) => {
        const id = ++seq;
        pending.set(id, resolve);
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      }),
    close: () => child.stdin.end(),
  };
}

// --- prérequis : witcalc installé (permanent, Exp 018) ---
{
  const list = await hostCmd(['list']);
  if (!/^witcalc@/m.test(list.out)) {
    const inst = await hostCmd(['install', SAMPLE]);
    note('prérequis : witcalc installé depuis samples/', inst.status === 0, inst.out.trim());
  } else {
    note('prérequis : witcalc déjà installé', true, 'plugins/witcalc');
  }
}

// --- Exp 018 : host + composant ---
{
  const wit = await hostCmd(['wit', 'witcalc']);
  timings.wit_ms = +wit.ms.toFixed(1);
  note('W1 WIT lue dans le binaire', wit.status === 0 && /export houetor:calc\/calc@0\.1\.0;/.test(wit.out),
    wit.out.split(/\r?\n/).find((l) => l.includes('export houetor')) ?? wit.out.slice(0, 120));

  const types = await hostCmd(['types', 'witcalc']);
  let fn = null;
  try { fn = JSON.parse(types.out); } catch { /* reste null */ }
  const okTypes =
    fn?.functions?.add?.params?.map((p) => `${p.name}:${p.type}`).join(',') === 'a:f64,b:f64' &&
    fn?.functions?.fibonacci?.params?.[0]?.type === 'u32' &&
    fn?.functions?.greet?.params?.[0]?.type === 'string' &&
    fn?.functions?.['read-file']?.returns === 'result<string, string>';
  note('W2 signatures typées lues dans le binaire (f64/u32/string/result)',
    okTypes, fn ? JSON.stringify(fn.functions).slice(0, 200) : types.out.slice(0, 150));
  note('W3 surface de capabilities visible AVANT exécution',
    fn?.imports?.some((i) => i.startsWith('wasi:filesystem/')) === true,
    fn?.imports?.filter((i) => i.startsWith('wasi:filesystem/')).join(', '));

  const run = async (args, env = {}) => {
    const r = await hostCmd(['run', ...args], env);
    let j = null;
    try { j = JSON.parse(r.out); } catch { /* erreur host → texte */ }
    return { ...r, j };
  };

  const a = await run(['witcalc', 'add', '2', '3.5']);
  timings.wall_wasmtime_ms = a.j?.timings_ms?.wall_wasmtime;
  note('W4 add(2, 3.5) = 5.5 (f64)', a.status === 0 && a.j?.result === 5.5, `result=${a.j?.result} wall=${a.j?.timings_ms?.wall_wasmtime}ms`);

  const f = await run(['witcalc', 'fibonacci', '45']);
  note('W5 fibonacci(45) = 1134903170 (portabilité composant)',
    f.status === 0 && f.j?.result === 1134903170, `result=${f.j?.result}`);

  const g = await run(['witcalc', 'greet', 'HOUETOR']);
  note('W6 greet → chaîne WAVE typée', g.status === 0 && g.j?.result === 'Bonjour, HOUETOR !',
    `result=${JSON.stringify(g.j?.result)}`);

  const bad = await run(['witcalc', 'add', 'x', '1']);
  note('W7 type invalide refusé par le typage WAVE',
    bad.status !== 0 && /type WIT/.test(bad.out), bad.out.trim().split(/\r?\n/).pop());

  const arity = await run(['witcalc', 'add', '1']);
  note('W8 arité contrôlée par la signature WIT',
    arity.status !== 0 && /paramètre\(s\)/.test(arity.out), arity.out.trim().split(/\r?\n/).pop());

  const noGrant = await run(['witcalc', 'read-file', 'data/input.txt']);
  note('W9 sans montage → err os 44 (deny-by-default)',
    noGrant.status === 0 && /^err\(/.test(noGrant.j?.result ?? ''), noGrant.j?.result);

  const grant = await run(['witcalc', 'read-file', 'data/input.txt'], {
    HOUETOR_PREOPENS: JSON.stringify({ data: CAPDATA }),
  });
  note('W10 avec HOUETOR_PREOPENS → ok contenu',
    grant.status === 0 && /^ok\("BONJOUR-WASM-CAP"\)$/.test(grant.j?.result ?? ''), grant.j?.result);

  const esc = await run(['witcalc', 'read-file', 'data/../secret.txt'], {
    HOUETOR_PREOPENS: JSON.stringify({ data: CAPDATA }),
  });
  const escText = esc.j?.result ?? esc.out;
  note('W11 évasion ../ refusée, secret non divulgué',
    /^err\(/.test(String(escText)) && !String(escText).includes(SECRET), String(escText).slice(0, 160));

  // W12 : variante sans permission → refus STATIQUE au chargement (nettoyé quoi qu'il arrive)
  const noFs = path.join(PLUGINS, 'witcalc-nofs');
  try {
    fs.mkdirSync(noFs, { recursive: true });
    fs.copyFileSync(path.join(SAMPLE, 'witcalc.wasm'), path.join(noFs, 'witcalc.wasm'));
    const m = JSON.parse(fs.readFileSync(path.join(SAMPLE, 'manifest.json'), 'utf8'));
    delete m.permissions;
    m.name = 'witcalc-nofs';
    fs.writeFileSync(path.join(noFs, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
    const refuse = await hostCmd(['info', 'witcalc-nofs']);
    note('W12 composant fs sans permission déclarée → refus statique',
      refuse.status !== 0 && /deny-by-default statique/.test(refuse.out), refuse.out.trim().split(/\r?\n/).pop());
  } finally {
    fs.rmSync(noFs, { recursive: true, force: true });
  }
}

// --- Exp 019 : pont MCP à types nommés ---
{
  const c = makeBridge();
  await c.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'component-test', version: '0.1' } });
  c.request('notifications/initialized'); // notification : le bridge n'y répond pas

  const list = await c.request('tools/list');
  const tools = list.result?.tools ?? [];
  const add = tools.find((t) => t.name === 'witcalc_add');
  const hello = tools.find((t) => t.name === 'hello_add');
  note('B1 inputSchema composant nommé+typé (pas de args[])',
    add &&
      add.inputSchema?.properties?.a?.type === 'number' &&
      add.inputSchema?.properties?.b?.type === 'number' &&
      JSON.stringify(add.inputSchema?.required) === '["a","b"]' &&
      !('args' in (add.inputSchema?.properties ?? {})),
    add ? JSON.stringify(add.inputSchema) : 'outil absent');
  note('B1b régression : module core garde le schéma legacy args[]',
    hello && hello.inputSchema?.properties?.args?.items?.type === 'number',
    hello ? JSON.stringify(hello.inputSchema) : 'outil absent');

  const greet = await c.request('tools/call', { name: 'witcalc_greet', arguments: { name: 'HOUETOR' } });
  let gj = null;
  try { gj = JSON.parse(greet.result?.content?.[0]?.text ?? ''); } catch { /* brut */ }
  note('B2 arguments NOMMÉS → chaîne typée',
    greet.result?.isError !== true && gj?.result === 'Bonjour, HOUETOR !', `result=${gj?.result}`);

  const addCall = await c.request('tools/call', { name: 'witcalc_add', arguments: { a: 2, b: 3.5 } });
  let aj = null;
  try { aj = JSON.parse(addCall.result?.content?.[0]?.text ?? ''); } catch { /* brut */ }
  note('B3 witcalc_add {"a":2,"b":3.5} → 5.5', addCall.result?.isError !== true && aj?.result === 5.5, `result=${aj?.result}`);

  const missing = await c.request('tools/call', { name: 'witcalc_add', arguments: { a: 2 } });
  note('B4 paramètre manquant → refus bridge',
    missing.result?.isError === true && /paramètre manquant/.test(missing.result?.content?.[0]?.text ?? ''),
    missing.result?.content?.[0]?.text);

  const wrong = await c.request('tools/call', { name: 'witcalc_add', arguments: { a: 'x', b: 1 } });
  note('B5 type invalide → refus host (type WIT)',
    wrong.result?.isError === true && /type WIT/.test(wrong.result?.content?.[0]?.text ?? ''),
    wrong.result?.content?.[0]?.text);

  const legacy = await c.request('tools/call', { name: 'hello_add', arguments: { args: [2, 3.5] } });
  let lj = null;
  try { lj = JSON.parse(legacy.result?.content?.[0]?.text ?? ''); } catch { /* brut */ }
  note('B6 régression hello_add (module core) → 5.5', legacy.result?.isError !== true && lj?.result === 5.5,
    `result=${lj?.result}`);

  c.close();
}

const out = {
  date: new Date().toISOString(),
  machine: `${process.platform} ${process.arch} ${process.version}`,
  component: 'witcalc@1.0.0 (houetor:calc/calc@0.1.0)',
  tools: { 'wit-bindgen': '0.62.0', 'wasm-tools': '1.261.0', wasmtime: '49.0.2' },
  timings_ms: timings,
  checks,
  all_checks_pass: allOk,
};
fs.writeFileSync(path.join(HERE, 'component_test.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks — tous verts : ${allOk}`);
console.log(`-> ${path.join(HERE, 'component_test.json')}`);
process.exit(allOk ? 0 : 1);
