// Exp 015 — Policy d'outils MCP côté bridge (filtrage allow/deny, fail-closed).
// Le bridge reçoit HOUETOR_MCP_POLICY = chemin JSON {"allow":[...], "deny":[...]}.
// Scénarios :
//  P1  policy filtrante : tools/list ne montre que hello_add
//  P2  hello_add (allowé) → appel OK (5.5)
//  P3  hello_fibonacci (allow + deny) → refusé par policy (deny prime)
//  P4  needy_do_log (hors allow) → refusé par policy, host JAMAIS atteint
//  P5  outil inexistant → « inconnu » (message distinct du refus policy)
//  P6  policy fichier illisible → fail-closed : liste vide + tout refusé
//  P7  sans policy (bridge par défaut) → rétrocompat : découverte complète
// Sortie : policy_test.json. Exit 0 si tous les checks passent.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(HERE, 'bridge.mjs');

const checks = [];
let allOk = true;
const note = (id, pass, detail) => {
  checks.push({ id, pass, ...(detail ? { detail } : {}) });
  if (!pass) allOk = false;
};

// client MCP minimal : spawn bridge + requêtes séquentielles JSON-RPC
function makeClient(env = {}) {
  const child = spawn(process.execPath, [BRIDGE], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, ...env },
  });
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
  let nextId = 0;
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }) + '\n');
      setTimeout(() => reject(new Error(`timeout ${method}`)), 10_000);
    });
  const notify = (method) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  const close = () => child.stdin.end();
  return { request, notify, close };
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'houetor-policy-'));
const POLICY = path.join(TMP, 'policy.json');
fs.writeFileSync(POLICY, JSON.stringify({ allow: ['hello_add', 'hello_fibonacci'], deny: ['hello_fibonacci'] }, null, 2));
const BROKEN = path.join(TMP, 'broken.json');
fs.writeFileSync(BROKEN, '{ ce n\'est pas du json');

// --- client 1 : policy filtrante ---
{
  const c = makeClient({ HOUETOR_MCP_POLICY: POLICY });
  const init = await c.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'policy-test', version: '0.1' } });
  note('P0 initialize', init.result?.serverInfo?.name === 'houetor-mcp-bridge', init.result?.serverInfo?.name);
  c.notify('notifications/initialized');

  const list = await c.request('tools/list');
  const names = (list.result?.tools ?? []).map((t) => t.name).sort();
  note('P1 tools/list filtré = [hello_add]', JSON.stringify(names) === '["hello_add"]', JSON.stringify(names));

  const ok = await c.request('tools/call', { name: 'hello_add', arguments: { args: [2, 3.5] } });
  const okText = ok.result?.content?.[0]?.text ?? '';
  let parsed = null;
  try { parsed = JSON.parse(okText); } catch {}
  note('P2 hello_add allowé → 5.5', parsed?.result === 5.5 && ok.result?.isError !== true, `result=${parsed?.result}`);

  const denied = await c.request('tools/call', { name: 'hello_fibonacci', arguments: { args: [10] } });
  const denText = denied.result?.content?.[0]?.text ?? '';
  note('P3 deny prime sur allow', denied.result?.isError === true && /deny/.test(denText), denText.slice(0, 100));

  const outside = await c.request('tools/call', { name: 'needy_do_log', arguments: { args: [1] } });
  const outText = outside.result?.content?.[0]?.text ?? '';
  note(
    'P4 hors allow → refus policy (host jamais atteint)',
    outside.result?.isError === true && /policy/.test(outText) && !/deny-by-default|host_log/.test(outText),
    outText.slice(0, 110)
  );

  const unknown = await c.request('tools/call', { name: 'does_not_exist', arguments: {} });
  const unkText = unknown.result?.content?.[0]?.text ?? '';
  note('P5 inconnu ≠ policy', unknown.result?.isError === true && /inconnu/.test(unkText) && !/policy/.test(unkText), unkText.slice(0, 80));
  c.close();
}

// --- client 2 : policy cassée → fail-closed ---
{
  const c = makeClient({ HOUETOR_MCP_POLICY: BROKEN });
  await c.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'policy-test', version: '0.1' } });
  c.notify('notifications/initialized');
  const list = await c.request('tools/list');
  const names = (list.result?.tools ?? []).map((t) => t.name);
  note('P6a policy illisible → liste vide', names.length === 0, JSON.stringify(names));
  const call = await c.request('tools/call', { name: 'hello_add', arguments: { args: [2, 3.5] } });
  const t = call.result?.content?.[0]?.text ?? '';
  note('P6b policy illisible → tout refusé (fail-closed)', call.result?.isError === true && /fail-closed/.test(t), t.slice(0, 110));
  c.close();
}

// --- client 3 : sans policy → rétrocompat 8/8 ---
{
  const c = makeClient({});
  await c.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'policy-test', version: '0.1' } });
  c.notify('notifications/initialized');
  const list = await c.request('tools/list');
  const names = (list.result?.tools ?? []).map((t) => t.name);
  note('P7 sans policy → découverte complète', names.includes('hello_add') && names.includes('needy_do_log'), `${names.length} outils`);
  c.close();
}

fs.rmSync(TMP, { recursive: true, force: true });

const out = {
  date: new Date().toISOString(),
  machine: `win32 x64 ${process.version}`,
  policy_format: '{ "allow": ["outil_exact", ...], "deny": ["outil_exact", ...] } — deny prime ; fichier illisible = fail-closed',
  checks,
  all_checks_pass: allOk,
};
fs.writeFileSync(path.join(HERE, 'policy_test.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) console.log(`${c.pass ? '✅' : '❌'} ${c.id}${c.detail ? ' — ' + c.detail : ''}`);
console.log(`\nTous les checks passent : ${allOk}`);
console.log(`-> ${path.join(HERE, 'policy_test.json')}`);
process.exit(allOk ? 0 : 1);
