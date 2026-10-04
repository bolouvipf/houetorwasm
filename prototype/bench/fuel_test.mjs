// Exp 020 - Isolation anti-DoS : fuel + timeout wasmtime côté hôte (plugin malveillant coupé).
// Plugin sujet : samples/spinhog (composant WIT, fonction `spin` = boucle infinie VOLONTAIRE).
// Scénarios :
//  F1  sans limites + appel bénin        → comportement par défaut inchangé (limits "aucun (illimité)")
//  F2  HOUETOR_FUEL=1000000 + add(2,3.5) → 5.5 (appel bénin passe SOUS la même limite)
//  F3  HOUETOR_FUEL=1000000 + spin       → coupé « fuel épuisé » en < 5 s (pas de hang)
//  F4  HOUETOR_FUEL=1000000 + fib(45)    → 1134903170 (travail long ACCEPTÉ sous la même limite)
//  F5  HOUETOR_FUEL=abc                  → refus AVANT exécution (valeur mal formée = fail-closed)
//  F6  HOUETOR_TIMEOUT=200ms + spin      → coupé « timeout atteint » en < 5 s
//  F7  HOUETOR_TIMEOUT=100 (sans unité)  → refus fail-closed
//  F8  limites + module core (hello)     → refus : chemin in-process non fuel-limable (pas d'ignorance silencieuse)
//  F9  bench sous limite                 → refusé (mesures faussées)
//  F10 SANS limites + spin               → bloqué jusqu'à la garde-fou hôte (60 s) : c'est CE QUE fuel corrige
//  F11 nettoyage                         → spinhog retiré ; hello/needy/witcalc intacts
// Sortie : fuel_test.json. Exit 0 si tous les checks passent.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(HERE, '..');
const HOST = path.join(PROTO, 'host', 'host.mjs');
const SAMPLE = path.join(PROTO, 'samples', 'spinhog');
const PLUGINS = path.join(PROTO, 'plugins');

const checks = [];
const timings = {};
let allOk = true;
const note = (id, pass, detail) => {
  checks.push({ id, pass, ...(detail ? { detail: String(detail).slice(0, 300) } : {}) });
  if (!pass) allOk = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`);
};

const host = (args, env = {}) => {
  const clean = { ...process.env };
  delete clean.HOUETOR_FUEL;
  delete clean.HOUETOR_TIMEOUT;
  const t0 = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [HOST, ...args], {
    encoding: 'utf8',
    env: { ...clean, ...env },
    timeout: 70_000, // garde-fou du test : > 60 s host + marge
    maxBuffer: 8 * 1024 * 1024,
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { status: r.status, ms, out: (r.stdout ?? '') + (r.stderr ?? ''), error: r.error };
};
const json = (r) => { try { return JSON.parse(r.out); } catch { return null; } };

// --- prérequis : plugin malveillant installé ---
{
  const list = host(['list']);
  if (!/^spinhog@/m.test(list.out)) {
    const inst = host(['install', SAMPLE]);
    note('prérequis : spinhog installé', inst.status === 0, inst.out.trim());
  } else note('prérequis : spinhog déjà installé', true, 'plugins/spinhog');
  if (!allOk) process.exit(1);
}

// F1 — défaut inchangé
{
  const r = host(['run', 'witcalc', 'add', '2', '3.5']);
  const j = json(r);
  note('F1 sans limites → add 5.5, limits "aucun (illimité)"',
    r.status === 0 && j?.result === 5.5 && j?.limits === 'aucun (illimité)',
    `result=${j?.result} limits=${j?.limits}`);
}
// F2 — bénin sous fuel
{
  const r = host(['run', 'witcalc', 'add', '2', '3.5'], { HOUETOR_FUEL: '1000000' });
  const j = json(r);
  note('F2 FUEL=1000000 → add(2,3.5)=5.5 (bénin accepté)',
    r.status === 0 && j?.result === 5.5 && j?.limits?.fuel === 1000000,
    `result=${j?.result} limits=${JSON.stringify(j?.limits)}`);
}
// F3 — spin coupé par le fuel
{
  const r = host(['run', 'spinhog', 'spin'], { HOUETOR_FUEL: '1000000' });
  timings.fuel_spin_ms = +r.ms.toFixed(1);
  note('F3 FUEL=1000000 → spin coupé « fuel épuisé » en < 5 s',
    r.status !== 0 && /fuel épuisé/.test(r.out) && r.ms < 5000,
    `exit=${r.status} ${Math.round(r.ms)}ms`);
}
// F4 — travail long accepté sous la même limite
{
  const r = host(['run', 'witcalc', 'fibonacci', '45'], { HOUETOR_FUEL: '1000000' });
  const j = json(r);
  note('F4 FUEL=1000000 → fibonacci(45)=1134903170 (travail long accepté)',
    r.status === 0 && j?.result === 1134903170, `result=${j?.result}`);
}
// F5 — fuel mal formé = refus avant exécution
{
  const r = host(['run', 'witcalc', 'add', '2', '3.5'], { HOUETOR_FUEL: 'abc' });
  note('F5 HOUETOR_FUEL=abc → refus fail-closed AVANT exécution',
    r.status !== 0 && /HOUETOR_FUEL invalide/.test(r.out), r.out.trim().split(/\r?\n/).pop());
}
// F6 — timeout coupé
{
  const r = host(['run', 'spinhog', 'spin'], { HOUETOR_TIMEOUT: '200ms' });
  timings.timeout_spin_ms = +r.ms.toFixed(1);
  note('F6 TIMEOUT=200ms → spin coupé « timeout atteint » en < 5 s',
    r.status !== 0 && /timeout atteint/.test(r.out) && r.ms < 5000,
    `exit=${r.status} ${Math.round(r.ms)}ms`);
}
// F7 — timeout sans unité = refus
{
  const r = host(['run', 'spinhog', 'spin'], { HOUETOR_TIMEOUT: '100' });
  note('F7 HOUETOR_TIMEOUT=100 (sans unité) → refus fail-closed',
    r.status !== 0 && /HOUETOR_TIMEOUT invalide/.test(r.out), r.out.trim().split(/\r?\n/).pop());
}
// F8 — limite + module core = refus (pas d'ignorance silencieuse)
{
  const r = host(['run', 'hello', 'add', '2', '3.5'], { HOUETOR_FUEL: '1000000' });
  note('F8 module core + fuel → refus (chemin in-process non fuel-limable)',
    r.status !== 0 && /module core exécuté in-process/.test(r.out), r.out.trim().split(/\r?\n/).pop());
}
// F9 — bench sous limite = refus
{
  const r = host(['bench', 'hello', 'fibonacci', '45', '1000'], { HOUETOR_TIMEOUT: '200ms' });
  note('F9 bench sous limite → refusé (mesures faussées)',
    r.status !== 0 && /bench interdit/.test(r.out), r.out.trim().split(/\r?\n/).pop());
}
// F10 — SANS limites : le malveillant tue le host jusqu'à la garde-fou (60 s) — le « avant »
{
  const r = host(['run', 'spinhog', 'spin']);
  timings.sans_limite_hang_ms = +r.ms.toFixed(1);
  note('F10 sans limites → spin bloque jusqu\'à la garde-fou hôte (> 55 s)',
    r.status !== 0 && /60 s/.test(r.out) && r.ms >= 55000,
    `exit=${r.status} ${Math.round(r.ms)}ms (avant-correction)`);
}
// F11 — nettoyage + intégrité des plugins
{
  const rm = host(['remove', 'spinhog']);
  const gone = !fs.existsSync(path.join(PLUGINS, 'spinhog'));
  const counts = {};
  for (const name of ['hello', 'needy', 'witcalc']) {
    const r = host(['info', name]);
    counts[name] = r.status === 0;
  }
  const staging = fs.readdirSync(PLUGINS).some((d) => d.startsWith('.staging-') || d.startsWith('.archive-tmp-'));
  note('F11 spinhog retiré, hello/needy/witcalc intacts',
    rm.status === 0 && gone && Object.values(counts).every(Boolean) && !staging,
    `gone=${gone} intact=${JSON.stringify(counts)} staging=${staging}`);
}

const out = {
  date: new Date().toISOString(),
  machine: `${process.platform} ${process.arch} ${process.version}`,
  plugin_malveillant: 'spinhog@1.0.0 (boucle infinie volontaire)',
  limites: { HOUETOR_FUEL: 'entier > 0 → wasmtime -W fuel=', HOUETOR_TIMEOUT: 'ex. 200ms → wasmtime -W timeout=' },
  timings_ms: timings,
  checks,
  all_checks_pass: allOk,
};
fs.writeFileSync(path.join(HERE, 'fuel_test.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks — tous verts : ${allOk}`);
console.log(`-> ${path.join(HERE, 'fuel_test.json')}`);
process.exit(allOk ? 0 : 1);
