#!/usr/bin/env node
// HOUETOR Plugin Host — MVP (Phase 3)
// Cycle de vie : discover -> validate manifest -> load (deny-by-default) -> call -> bench -> install -> remove -> registry
// Usage : node host.mjs <list|info|run|bench|install|install-url|remove|registry|hash|keygen|sign|wit|types> [...]
// Provenance (Exp 016) : HOUETOR_TRUST_KEYS = chemins de clés publiques PEM (séparées , ou ;) ;
// Composants WIT (Exp 018) : manifeste "type":"component" → exécution via wasmtime (--invoke WAVE),
//   types lus dans le binaire via `wasm-tools component wit` ; montage fs = HOUETOR_PREOPENS (JSON {"guest":"hôte"}).
// Limites d'exécution (Exp 020) : HOUETOR_FUEL (entier > 0) + HOUETOR_TIMEOUT (ex. 200ms) → `-W fuel=` / `-W timeout=`
//   sur le chemin composant (wasmtime) ; échec ferme si valeur invalide, ou si un module core
//   (exécution in-process Node, non fuel-limable) est lancé avec ces variables actives.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url)); // prototype/host
const PLUGINS = path.resolve(ROOT, "..", "plugins");
// deny-by-default : aucune capability accordée par défaut, SAUF « wasi:filesystem » qui n'accorde
// AUCUN fichier tant que HOUETOR_PREOPENS ne liste pas les montages (double verrou, Exp 018).
const HOST_ALLOWED = ["wasi:filesystem"];

const die = (msg, code = 1) => {
  console.error("[host] ERREUR : " + msg);
  process.exit(code);
};
const now = () => performance.now();
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// --- Provenance Ed25519 (Exp 016) : clés de confiance + vérification de manifest.sig ---
const TRUST_KEYS = (process.env.HOUETOR_TRUST_KEYS ?? "")
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);
const SIG_PATH = (manifestDir) => path.join(manifestDir, "manifest.sig");

function loadTrustKeys() {
  if (!TRUST_KEYS.length) return [];
  return TRUST_KEYS.map((p) => {
    try {
      return { path: p, key: crypto.createPublicKey(fs.readFileSync(p)) };
    } catch (e) {
      die(`HOUETOR_TRUST_KEYS : clé publique illisible (${p}) : ${e.message}`);
    }
  });
}

// Vérifie manifest.sig contre les clés de confiance. États : absent (null) / valide (true).
// Meurt sur configuration dangereuse ou signature invalide.
function verifySigData(data, sig, ctx) {
  const trust = loadTrustKeys();
  if (!trust.length)
    die(`${ctx} : manifest.sig présent mais AUCUNE clé de confiance configurée (HOUETOR_TRUST_KEYS) — provenance non vérifiable`);
  if (!sig || sig.alg !== "ed25519" || typeof sig.sig !== "string") die(`${ctx} : manifest.sig invalide (alg/sig manquants)`);
  const ok = trust.some((t) => {
    try {
      return crypto.verify(null, data, t.key, Buffer.from(sig.sig, "base64"));
    } catch {
      return false;
    }
  });
  if (!ok) die(`${ctx} : signature Ed25519 INVALIDE (manifeste modifié ou clé non approuvée) — refusé`);
  return true;
}

function verifySig(manifestDir, ctx) {
  const sigFile = SIG_PATH(manifestDir);
  if (!fs.existsSync(sigFile)) return null;
  let sig;
  try {
    sig = JSON.parse(fs.readFileSync(sigFile, "utf8"));
  } catch (e) {
    die(`${ctx} : manifest.sig illisible (${e.message})`);
  }
  return verifySigData(fs.readFileSync(path.join(manifestDir, "manifest.json")), sig, ctx);
}

// --- Composants WIT (Exp 018) : outillage, lecture des types dans le BINAIRE, encodage WAVE ---
function findTool(base, envVar) {
  if (process.env[envVar]) return process.env[envVar];
  const ext = process.platform === "win32" ? ".exe" : "";
  const bin = path.join(process.env.USERPROFILE ?? "", ".local", "bin");
  try {
    const direct = path.join(bin, base + ext);
    if (fs.existsSync(direct)) return direct;
    for (const d of fs.readdirSync(bin)) {
      if (!d.startsWith(base + "-")) continue;
      const p = path.join(bin, d, base + ext);
      if (fs.existsSync(p)) return p;
    }
  } catch { /* dossier absent */ }
  return base; // PATH en secours
}
const WASMTIME = () => findTool("wasmtime", "HOUETOR_WASMTIME");
const WASMTOOLS = () => findTool("wasm-tools", "HOUETOR_WASMTOOLS");

function runTool(exe, args, ctx) {
  const r = spawnSync(exe, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 60_000 });
  if (r.error) die(`${ctx} : impossible de lancer ${exe} (${r.error.message})`);
  return r;
}

// Prend une accolade ouvrante à `open` dans `s` et renvoie l'index de l'accolade fermante.
function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const WIT_TYPES = {
  f32: "number", f64: "number",
  u8: "integer", u16: "integer", u32: "integer", u64: "integer",
  s8: "integer", s16: "integer", s32: "integer", s64: "integer",
  bool: "boolean", char: "string", string: "string",
};

// Lit la surface de capabilities + les signatures DANS LE BINAIRE (`wasm-tools component wit`).
// C'est la preuve de la Phase 1 §2.2 : la surface est inspectable statiquement.
function componentInfo(wasmPath, ctx) {
  const r = runTool(WASMTOOLS(), ["component", "wit", wasmPath], ctx ?? wasmPath);
  if (r.status !== 0) die(`${ctx ?? wasmPath} : wasm-tools component wit a échoué (${(r.stderr || "").trim()})`);
  const wit = r.stdout;
  const imports = [...wit.matchAll(/^\s*import\s+([\w:@./-]+);/gm)].map((m) => m[1]);
  const exports = [...wit.matchAll(/^\s*export\s+([\w:@./-]+);/gm)].map((m) => m[1]);
  // interface exportée : nom complet « pkg/iface@ver » → corps de l'interface
  const functions = {};
  let interfaceName = null;
  if (exports.length) {
    const full = exports[0]; // ex. houetor:calc/calc@0.1.0
    const verIdx = full.lastIndexOf("@");
    const noVer = verIdx > 0 ? full.slice(0, verIdx) : full;
    const iface = noVer.slice(noVer.lastIndexOf("/") + 1);
    const pkg = noVer.slice(0, noVer.lastIndexOf("/"));
    const pkgBlock = wit.match(new RegExp(`package\\s+${pkg.replace(/[:]/g, "\\:")}@[^\\s{]+\\s*\\{`));
    if (pkgBlock) {
      const body = wit.slice(pkgBlock.index + pkgBlock[0].length, matchBrace(wit, pkgBlock.index + pkgBlock[0].length - 1));
      const ifaceRe = new RegExp(`interface\\s+${iface}\\s*\\{`);
      const m = body.match(ifaceRe);
      if (m) {
        const start = body.indexOf(m[0]) + m[0].length - 1;
        const ib = body.slice(start + 1, matchBrace(body, start));
        for (const f of ib.matchAll(/([a-z][\w-]*)\s*:\s*func\s*\(([^)]*)\)\s*(?:->\s*([^;]+))?;/g)) {
          const params = f[2].trim()
            ? f[2].split(",").map((p) => {
                const i = p.indexOf(":");
                return { name: p.slice(0, i).trim(), type: p.slice(i + 1).trim() };
              })
            : [];
          functions[f[1]] = { params, returns: (f[3] ?? "").trim() };
        }
        interfaceName = full;
      }
    }
  }
  return { wit, imports, exports, functions, interfaceName };
}

// HOUETOR_PREOPENS = JSON {"<guest>":"<hôte>"} — SEUL moyen d'ouvrir un fichier à un composant.
function preopenArgs(p) {
  if (!p.manifest.permissions.includes("wasi:filesystem")) return [];
  let raw = process.env.HOUETOR_PREOPENS;
  if (!raw) return []; // pas de montage → deny-by-default au niveau OS
  let map;
  try {
    map = JSON.parse(raw);
  } catch (e) {
    die(`${p.manifest.name} : HOUETOR_PREOPENS illisible (${e.message}) — refusé (fail-closed)`);
  }
  return Object.entries(map).flatMap(([guest, host]) => {
    if (!fs.existsSync(host)) die(`${p.manifest.name} : montage inexistant dans HOUETOR_PREOPENS : ${host}`);
    return ["--dir", `${host}::${guest}`];
  });
}

// Limites d'exécution (Exp 020) : fuel (unités) + timeout (temps machine) via wasmtime `-W`.
// Fail-closed : valeur mal formée = refus AVANT exécution (jamais d'ignorance silencieuse).
// Retour : null (aucune limite) ou { fuel, timeout, args: [...] } à insérer dans l'invocation wasmtime.
function executionLimits(ctx) {
  const fuel = process.env.HOUETOR_FUEL;
  const timeout = process.env.HOUETOR_TIMEOUT;
  if (fuel === undefined && timeout === undefined) return null;
  const lim = { args: [] };
  if (fuel !== undefined) {
    if (!/^[1-9][0-9]*$/.test(fuel))
      die(`${ctx} : HOUETOR_FUEL invalide « ${fuel} » — attendu entier strictement positif (ex. 1000000) — refusé (fail-closed)`);
    lim.fuel = fuel;
    lim.args.push("-W", `fuel=${fuel}`);
  }
  if (timeout !== undefined) {
    if (!/^[1-9][0-9]*(us|ms|s)$/.test(timeout))
      die(`${ctx} : HOUETOR_TIMEOUT invalide « ${timeout} » — attendu durée à unité (ex. 200ms, 2s) — refusé (fail-closed)`);
    lim.timeout = timeout;
    lim.args.push("-W", `timeout=${timeout}`);
  }
  return lim;
}

// Encodage WAVE (text encoding des valeurs du Component Model) selon le type WIT déclaré.
function waveEncode(arg, witType, fnName) {
  const t = (witType ?? "").trim();
  if (WIT_TYPES[t] === "string") return JSON.stringify(String(arg));
  if (WIT_TYPES[t] === "boolean") return arg === true || arg === "true" ? "true" : "false";
  if (WIT_TYPES[t] === "number" || WIT_TYPES[t] === "integer") {
    if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(String(arg)))
      die(`type WIT : ${fnName} attend ${t || "un nombre"}, reçu « ${arg} » — refusé avant exécution`);
    return String(arg);
  }
  // type inconnu : on tente le nombre, sinon la chaîne
  return /^-?\d+(\.\d+)?$/.test(String(arg)) ? String(arg) : JSON.stringify(String(arg));
}

function discover() {
  if (!fs.existsSync(PLUGINS)) return [];
  return fs
    .readdirSync(PLUGINS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(PLUGINS, d.name, "manifest.json")))
    .map((d) => loadManifest(d.name));
}

function loadManifest(dirName) {
  const dir = path.join(PLUGINS, dirName);
  const mPath = path.join(dir, "manifest.json");
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(mPath, "utf8"));
  } catch (e) {
    die(`${dirName} : manifest.json illisible ou JSON invalide (${e.message})`);
  }
  for (const field of ["name", "version", "wasm", "exports"]) {
    if (!(field in raw)) die(`${dirName} : champ obligatoire manquant dans le manifeste : "${field}"`);
  }
  if (!Array.isArray(raw.exports) || raw.exports.length === 0)
    die(`${dirName} : "exports" doit être un tableau non vide`);
  const perms = raw.permissions ?? [];
  const illegal = perms.filter((p) => !HOST_ALLOWED.includes(p));
  if (illegal.length)
    die(`${dirName} : permissions NON accordées par l'hôte : ${illegal.join(", ")}`);
  const wasmPath = path.join(dir, raw.wasm);
  if (!fs.existsSync(wasmPath)) die(`${dirName} : fichier wasm manquant : ${raw.wasm}`);
  // composant (Exp 018) : surface de capabilities lue DANS LE BINAIRE, avant toute exécution
  let cinfo = null;
  if (raw.type === "component") {
    cinfo = componentInfo(wasmPath, `${dirName} (wasm-tools)`);
    const wantsFs = cinfo.imports.some((i) => i.startsWith("wasi:filesystem"));
    if (wantsFs && !perms.includes("wasi:filesystem"))
      die(`${dirName} : composant importe wasi:filesystem (visible dans le binaire) mais le manifeste ne déclare pas "wasi:filesystem" — refusé (deny-by-default statique)`);
    const declared = Object.keys(cinfo.functions);
    const missing = raw.exports.filter((f) => !declared.includes(f));
    if (missing.length)
      die(`${dirName} : exports absents de l'interface WIT du composant : ${missing.join(", ")}`);
  }
  // provenance (Exp 016) : manifest.signé → vérification obligatoire si présent
  verifySig(dir, dirName);
  // intégrité (Exp 014) : si le manifeste épingle sha256, tout écart = refus
  if (raw.sha256 !== undefined) {
    const actual = sha256(fs.readFileSync(wasmPath));
    if (actual !== raw.sha256)
      die(`${dirName} : sha256 INCONGRU (manifeste ${String(raw.sha256).slice(0, 12)}…, fichier ${actual.slice(0, 12)}…) — contenu altéré ?`);
  }
  return { dir, manifest: raw, wasmPath, permissions: perms, cinfo };
}

async function loadPlugin(p) {
  const bytes = fs.readFileSync(p.wasmPath);
  const t0 = now();
  const module = await WebAssembly.compile(bytes);
  const tCompile = now() - t0;

  const imports = WebAssembly.Module.imports(module);
  const granted = new Set(p.permissions);
  const denied = imports.filter((i) => !granted.has(`${i.module}.${i.name}`));
  if (denied.length) {
    const list = denied.map((i) => `${i.module}.${i.name}`).join(", ");
    throw new Error(
      `sandbox deny-by-default : imports refusés [${list}] (permissions accordées : ${
        granted.size ? [...granted].join(", ") : "aucune"
      })`
    );
  }
  const importObject = {};
  const t1 = now();
  const instance = await WebAssembly.instantiate(module, importObject);
  const tInst = now() - t1;

  const missing = p.manifest.exports.filter((f) => typeof instance.exports[f] !== "function");
  if (missing.length) throw new Error(`exports annoncés absents du binaire : ${missing.join(", ")}`);

  return { instance, stats: { bytes: bytes.length, tCompile, tInst, imports } };
}

function parseArgs(argv) {
  return argv.map((a) => {
    const n = Number(a);
    return Number.isNaN(n) ? a : n;
  });
}

const [cmd, ...rest] = process.argv.slice(2);

// Installation partagée (install local + install-url) : src = dossier contenant manifest.json + wasm
function doInstall(src, srcManifest) {
  const dest = path.join(PLUGINS, srcManifest.name);
  if (fs.existsSync(dest)) {
    const old = JSON.parse(fs.readFileSync(path.join(dest, "manifest.json"), "utf8"));
    if (old.version === srcManifest.version) die(`${srcManifest.name} : version ${old.version} déjà installée (incrémentez la version)`);
    const hist = path.join(dest, ".history");
    fs.mkdirSync(hist, { recursive: true });
    const archive = path.join(hist, old.version);
    // cpSync interdit de copier un dossier dans son propre sous-dossier :
    // on archive d'abord via un dossier temporaire à l'extérieur, puis on déplace.
    const tmp = path.join(PLUGINS, `.archive-tmp-${old.version}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.cpSync(dest, tmp, {
      recursive: true,
      filter: (s) => !s.includes(".history") && !s.includes(path.sep + "target"),
    });
    fs.rmSync(archive, { recursive: true, force: true });
    fs.renameSync(tmp, archive);
    console.log(`[host] version précédente ${old.version} archivée → ${path.relative(ROOT, archive)}`);
  }
  fs.mkdirSync(PLUGINS, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  // revalide après installation
  loadManifest(srcManifest.name);
  console.log(`[host] installé : ${srcManifest.name}@${srcManifest.version}`);
}

// Validation rapide AVANT installation (manifeste distant non fiable)
function precheckManifest(raw, ctx) {
  for (const field of ["name", "version", "wasm", "exports"]) {
    if (!(field in raw)) die(`${ctx} : champ obligatoire manquant dans le manifeste : "${field}"`);
  }
  if (!Array.isArray(raw.exports) || raw.exports.length === 0) die(`${ctx} : "exports" doit être un tableau non vide`);
  const perms = raw.permissions ?? [];
  const illegal = perms.filter((p) => !HOST_ALLOWED.includes(p));
  if (illegal.length) die(`${ctx} : permissions NON accordées par l'hôte : ${illegal.join(", ")}`);
  if (raw.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(String(raw.sha256)))
    die(`${ctx} : "sha256" doit être une empreinte hexadécimale sur 64 caractères`);
}

switch (cmd) {
  case "list": {
    const plugins = discover();
    if (!plugins.length) {
      console.log("[host] aucun plugin découvert dans " + PLUGINS);
      break;
    }
    for (const p of plugins)
      console.log(
        `${p.manifest.name}@${p.manifest.version}  size=${fs.statSync(p.wasmPath).size}B  exports=[${p.manifest.exports.join(",")}]  perms=[${
          p.permissions.join(",") || "aucune"
        }]  sha256=${p.manifest.sha256 ? "épinglé" : "absent"}  type=${p.manifest.type ?? "module"}`
      );
    break;
  }

  case "hash": {
    // aide à la rédaction de manifeste (Exp 014) : imprime l'empreinte du wasm d'un dossier-plugin
    const src = rest[0];
    if (!src) die("usage : hash <dossier-plugin>");
    const m = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8"));
    const wasmSrc = path.join(src, m.wasm);
    if (!fs.existsSync(wasmSrc)) die(`${m.name} : fichier wasm manquant : ${m.wasm}`);
    console.log(sha256(fs.readFileSync(wasmSrc)));
    break;
  }

  case "info": {
    const p = loadManifest(rest[0] ?? die("usage : info <plugin>"));
    const bytes = fs.readFileSync(p.wasmPath);
    if (p.manifest.type === "component") {
      console.log(JSON.stringify({
        manifest: p.manifest,
        disk_size: bytes.length,
        interface: p.cinfo.interfaceName,
        imports: p.cinfo.imports,
        functions: p.cinfo.functions,
      }, null, 2));
      break;
    }
    const mod = await WebAssembly.compile(bytes);
    console.log(JSON.stringify({
      manifest: p.manifest,
      disk_size: bytes.length,
      imports: WebAssembly.Module.imports(mod),
      exports: WebAssembly.Module.exports(mod).map((e) => e.kind + ":" + e.name),
    }, null, 2));
    break;
  }

  case "wit": {
    // Exp 018 : WIT du composant lu dans le binaire (preuve : types = contrat, pas du JSON déclaratif)
    const p = loadManifest(rest[0] ?? die("usage : wit <plugin>"));
    if (p.manifest.type !== "component") die(`${p.manifest.name} : module core (pas un composant) — pas de WIT`);
    process.stdout.write(p.cinfo.wit);
    break;
  }

  case "types": {
    // Exp 018/019 : signatures exportées en JSON (alimente les inputSchema MCP)
    const p = loadManifest(rest[0] ?? die("usage : types <plugin>"));
    if (p.manifest.type !== "component") die(`${p.manifest.name} : module core — signatures non typées (ABI nombre[] seulement)`);
    console.log(JSON.stringify({
      plugin: `${p.manifest.name}@${p.manifest.version}`,
      interface: p.cinfo.interfaceName,
      imports: p.cinfo.imports,
      functions: p.cinfo.functions,
    }, null, 2));
    break;
  }

  case "run": {
    const [name, fn, ...args] = rest;
    if (!name || !fn) die("usage : run <plugin> <fonction> [args...]");
    const lim = executionLimits(name); // Exp 020 : validées AVANT toute exécution
    const p = loadManifest(name);
    if (!p.manifest.exports.includes(fn)) die(`${name} : fonction "${fn}" non déclarée dans le manifeste`);
    // --- Composant (Exp 018) : typage fort, encodage WAVE, exécution wasmtime ---
    if (p.manifest.type === "component") {
      const fnInfo = p.cinfo.functions[fn];
      if (!fnInfo) die(`${name} : fonction "${fn}" absente de l'interface WIT du composant`);
      if (args.length !== fnInfo.params.length)
        die(`${name} : ${fn} attend ${fnInfo.params.length} paramètre(s) [${fnInfo.params
          .map((x) => `${x.name}: ${x.type}`)
          .join(", ")}], reçu ${args.length}`);
      const expr = `${fn}(${args.map((a, i) => waveEncode(a, fnInfo.params[i].type, fn)).join(", ")})`;
      const grants = preopenArgs(p);
      const tc0 = now();
      const r = spawnSync(WASMTIME(), ["run", ...grants, ...(lim?.args ?? []), "--invoke", expr, p.wasmPath], {
        encoding: "utf8",
        timeout: 60_000,
      });
      const wall = now() - tc0;
      if (r.error) {
        if (r.error.code === "ETIMEDOUT" || /timed out/i.test(r.error.message))
          die(`${name} : exécution > 60 s — coupée par la garde-fou hôte (AUCUNE limite fuel/timeout configurée — voir HOUETOR_FUEL/HOUETOR_TIMEOUT, Exp 020)`);
        die(`${name} : wasmtime inaccessible (${r.error.message})`);
      }
      if (r.status !== 0) {
        const err = (r.stderr ?? "").trim();
        if (/while interpreting parameters in invoke/.test(err))
          die(`${name} : argument(s) refusés par le Component Model (typage WAVE) — ${err.split(/\r?\n/).pop()}`);
        if (lim?.fuel && /all fuel consumed/.test(err))
          die(`${name} : fuel épuisé (HOUETOR_FUEL=${lim.fuel}) — exécution coupée (anti-DoS, Exp 020)`);
        if (lim?.timeout && /wasm trap: interrupt/.test(err))
          die(`${name} : timeout atteint (HOUETOR_TIMEOUT=${lim.timeout}) — exécution coupée (anti-DoS, Exp 020)`);
        die(`${name} : exécution échouée — ${err}`);
      }
      const out = (r.stdout ?? "").trim();
      let result = out;
      try {
        result = JSON.parse(out);
      } catch { /* WAVE non JSON (result/variant) → texte brut */ }
      console.log(JSON.stringify({
        plugin: `${p.manifest.name}@${p.manifest.version}`,
        type: "component",
        interface: p.cinfo.interfaceName,
        call: fn,
        args,
        result,
        timings_ms: { wall_wasmtime: +wall.toFixed(3) },
        limits: lim
          ? { ...(lim.fuel ? { fuel: Number(lim.fuel) } : {}), ...(lim.timeout ? { timeout: lim.timeout } : {}) }
          : "aucun (illimité)",
        grants: grants.length ? grants.join(" ") : "aucun (deny-by-default)",
        wasm_bytes: fs.statSync(p.wasmPath).size,
        engine: "wasmtime (Component Model, WAVE)",
      }, null, 2));
      break;
    }
    // Module core (Exp 020) : exécution in-process Node — AUCUN fuel/timeout possible.
    // Plutôt que d'ignorer silencieusement la demande, on refuse (fail-closed).
    if (lim)
      die(
        `${name} : limites actives (${[lim.fuel ? `HOUETOR_FUEL=${lim.fuel}` : null, lim.timeout ? `HOUETOR_TIMEOUT=${lim.timeout}` : null]
          .filter(Boolean).join(", ")}) mais ce plugin est un module core exécuté in-process (Node) : ` +
          `fuel/timeout impossible sur ce chemin — utiliser un composant ("type":"component", wasmtime) — refusé (fail-closed)`
      );
    const t0 = now();
    let loaded;
    try {
      loaded = await loadPlugin(p);
    } catch (e) {
      die(`${name} : chargement refusé — ${e.message}`);
    }
    const { instance, stats } = loaded;
    const tLoad = now() - t0;
    const t1 = now();
    const result = instance.exports[fn](...parseArgs(args));
    const tCall = now() - t1;
    console.log(JSON.stringify({
      plugin: `${p.manifest.name}@${p.manifest.version}`,
      call: fn, args, result,
      timings_ms: { load: +tLoad.toFixed(3), compile: +stats.tCompile.toFixed(3), instantiate: +stats.tInst.toFixed(3), call: +tCall.toFixed(4) },
      wasm_bytes: stats.bytes,
      memory_bytes: instance.exports.memory ? instance.exports.memory.buffer.byteLength : 0,
      imports_granted: stats.imports.length,
    }, null, 2));
    break;
  }

  case "bench": {
    // usage : bench <plugin> <fn> <argsCSV|-> <itérations>
    const [name, fn, argsCsv, itersRaw] = rest;
    if (!name || !fn || argsCsv === undefined || itersRaw === undefined)
      die("usage : bench <plugin> <fonction> <argsCSV|-> <itérations>");
    const iters = Number(itersRaw);
    const fnArgs = argsCsv === "-" ? [] : String(argsCsv).split(",").map(Number);
    const p = loadManifest(name);
    if (!p.manifest.exports.includes(fn)) die(`${name} : fonction "${fn}" non déclarée dans le manifeste`);
    if (p.manifest.type === "component")
      die(`${name} : bench non supporté pour un composant (1 spawn wasmtime par appel) — mesures dans prototype/bench/component_test.mjs`);
    // Exp 020 : un banc sous fuel/timeout mesure autre chose → refus plutôt qu'une mesure faussée
    if (executionLimits(name) !== null)
      die(`${name} : bench interdit avec HOUETOR_FUEL/HOUETOR_TIMEOUT actifs (mesures faussées) — déconnecter les limites`);
    // démarrage à froid (aucun cache)
    const t0 = now();
    let loaded;
    try {
      loaded = await loadPlugin(p);
    } catch (e) {
      die(`${name} : chargement refusé — ${e.message}`);
    }
    const { instance, stats } = loaded;
    const coldLoad = now() - t0;
    const warm = instance.exports[fn];
    // échauffement
    for (let i = 0; i < 100; i++) warm(...fnArgs);
    const tF = now();
    const first = warm(...fnArgs);
    const firstCall = now() - tF;
    const t1 = now();
    for (let i = 0; i < iters; i++) warm(...fnArgs);
    const compute = now() - t1;
    const perCall = compute / iters;
    console.log(JSON.stringify({
      plugin: `${p.manifest.name}@${p.manifest.version}`,
      call: fn, args: fnArgs, result: first,
      iterations: iters,
      first_call_us: +(firstCall * 1000).toFixed(3),
      cold_load_ms: +coldLoad.toFixed(3),
      compile_ms: +stats.tCompile.toFixed(3),
      instantiate_ms: +stats.tInst.toFixed(3),
      compute_ms: +compute.toFixed(3),
      per_call_ns: +(perCall * 1e6).toFixed(2),
      wasm_bytes: stats.bytes,
      memory_bytes: instance.exports.memory ? instance.exports.memory.buffer.byteLength : 0,
      maxrss_kb: Math.round(process.resourceUsage().maxRSS),
      machine: process.platform + " " + process.arch + " node " + process.version,
      date: new Date().toISOString(),
    }));
    break;
  }

  case "install": {
    const src = rest[0];
    if (!src) die("usage : install <dossier-plugin>");
    const srcManifest = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8"));
    // provenance AVANT copie (Exp 016)
    verifySig(src, `${srcManifest.name} (source)`);
    // intégrité AVANT copie (Exp 014) : un src altéré n'entre jamais dans plugins/
    if (srcManifest.sha256 !== undefined) {
      const wasmSrc = path.join(src, srcManifest.wasm);
      if (!fs.existsSync(wasmSrc)) die(`${srcManifest.name} : fichier wasm manquant : ${srcManifest.wasm}`);
      const actual = sha256(fs.readFileSync(wasmSrc));
      if (actual !== srcManifest.sha256)
        die(`${srcManifest.name} : sha256 INCONGRU (manifeste ${String(srcManifest.sha256).slice(0, 12)}…, fichier ${actual.slice(0, 12)}…) — installation refusée`);
    }
    doInstall(src, srcManifest);
    break;
  }

  case "install-url": {
    // Registre distant : <base>/manifest.json + <base>/<wasm> (HTTP(S) ou file://)
    const base = rest[0];
    if (!base) die("usage : install-url <baseURL>   (ex. http://127.0.0.1:5099/regprobe/1.0.1)");
    let manifest;
    let manifestText;
    try {
      const res = await fetch(new URL("manifest.json", base));
      if (!res.ok) die(`install-url : manifest.json inaccessible (HTTP ${res.status})`);
      manifestText = await res.text();
      manifest = JSON.parse(manifestText);
    } catch (e) {
      die(`install-url : échec du téléchargement du manifeste (${e.message})`);
    }
    precheckManifest(manifest, `${base} (manifeste distant)`);
    // Exp 014 : le contenu DISTANT doit être épinglé — sha256 obligatoire
    if (manifest.sha256 === undefined)
      die(`install-url : champ "sha256" obligatoire pour une source distante (épinglage du contenu)`);
    // Exp 016 : la provenance DISTANTE doit être signée — manifest.sig obligatoire
    let sigObj;
    try {
      const sigRes = await fetch(new URL("manifest.sig", base));
      if (!sigRes.ok) die(`install-url : manifest.sig absent/inaccessible (HTTP ${sigRes.status}) — signature obligatoire à distance`);
      sigObj = await sigRes.json();
    } catch (e) {
      if (String(e.message).includes("HTTP")) die(e.message);
      die(`install-url : manifest.sig illisible (${e.message})`);
    }
    verifySigData(Buffer.from(manifestText), sigObj, `${base} (signature distante)`);
    // doublon testé AVANT staging : die() ne déclenche pas de cleanup
    const destCheck = path.join(PLUGINS, manifest.name);
    if (fs.existsSync(destCheck)) {
      const old = JSON.parse(fs.readFileSync(path.join(destCheck, "manifest.json"), "utf8"));
      if (old.version === manifest.version)
        die(`${manifest.name} : version ${old.version} déjà installée (incrémentez la version)`);
    }
    const staging = path.join(PLUGINS, `.staging-${manifest.name}-${manifest.version}`);
    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true });
    // NB : die() = process.exit → pas de finally fiable ; on nettoie AVANT chaque sortie d'erreur
    let wRes;
    try {
      wRes = await fetch(new URL(String(manifest.wasm), base));
    } catch (e) {
      fs.rmSync(staging, { recursive: true, force: true });
      die(`install-url : échec du téléchargement du wasm (${e.message})`);
    }
    if (!wRes.ok) {
      fs.rmSync(staging, { recursive: true, force: true });
      die(`install-url : wasm inaccessible (HTTP ${wRes.status})`);
    }
    // épinglage (Exp 014) : vérifier l'empreinte des octets REÇUS avant installation
    const received = Buffer.from(await wRes.arrayBuffer());
    const actual = sha256(received);
    if (actual !== String(manifest.sha256)) {
      fs.rmSync(staging, { recursive: true, force: true });
      die(`install-url : sha256 INCONGRU (manifeste ${String(manifest.sha256).slice(0, 12)}…, reçu ${actual.slice(0, 12)}…) — contenu altéré, rien n'est installé`);
    }
    // chemin wasm exact du manifeste (sous-dossiers possibles)
    const wasmDest = path.join(staging, String(manifest.wasm));
    fs.mkdirSync(path.dirname(wasmDest), { recursive: true });
    fs.writeFileSync(wasmDest, received);
    // OCTETS BRUTS : la signature porte sur manifest.json reçu tel quel (re-serialiser casserait le lien)
    fs.writeFileSync(path.join(staging, "manifest.json"), manifestText);
    fs.writeFileSync(path.join(staging, "manifest.sig"), JSON.stringify(sigObj, null, 2) + "\n");
    doInstall(staging, manifest);
    fs.rmSync(staging, { recursive: true, force: true });
    break;
  }

  case "registry": {
    // Layout : <registre>/<nom>/<version>/manifest.json  → découverte sans installation
    const reg = rest[0];
    if (!reg) die("usage : registry <dossier-registre>   (layout <reg>/<nom>/<version>/manifest.json)");
    if (!fs.existsSync(reg)) die(`registre introuvable : ${reg}`);
    let count = 0;
    for (const name of fs.readdirSync(reg)) {
      const nameDir = path.join(reg, name);
      if (!fs.statSync(nameDir).isDirectory()) continue;
      for (const version of fs.readdirSync(nameDir)) {
        const mPath = path.join(nameDir, version, "manifest.json");
        if (!fs.existsSync(mPath)) continue;
        // un registre peut contenir des entrées corrompues : on les signale sans planter
        let m;
        try {
          m = JSON.parse(fs.readFileSync(mPath, "utf8"));
          if (!Array.isArray(m.exports)) throw new Error('"exports" absent ou invalide');
        } catch (e) {
          console.log(`${name}@${version}  INVALIDE (${e.message}) — ignoré`);
          count++;
          continue;
        }
        const wasmSize = fs.existsSync(path.join(nameDir, version, m.wasm))
          ? fs.statSync(path.join(nameDir, version, m.wasm)).size
          : "?";
        console.log(`${m.name}@${m.version}  size=${wasmSize}B  exports=[${m.exports.join(",")}]  perms=[${(m.permissions ?? []).join(",") || "aucune"}]`);
        count++;
      }
    }
    if (!count) console.log(`[host] registre vide : ${reg}`);
    break;
  }

  case "remove": {
    const name = rest[0];
    if (!name) die("usage : remove <plugin>");
    const dest = path.join(PLUGINS, name);
    if (!fs.existsSync(dest)) die(`${name} : plugin introuvable`);
    fs.rmSync(dest, { recursive: true, force: true });
    console.log(`[host] retiré : ${name} (plus aucun fichier, plus aucune instance)`);
    break;
  }

  case "keygen": {
    // Exp 016 : paire Ed25519 pour signer/contrôler les manifestes (clé privée = secrète)
    const [privPath, pubPath] = rest;
    if (!privPath) die("usage : keygen <clé-privée.pem> [clé-publique.pem]");
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(privPath, privateKey.export({ type: "pkcs8", format: "pem" }));
    const pubOut = pubPath ?? privPath.replace(/(\.pem)?$/i, ".pub$1");
    fs.writeFileSync(pubOut, publicKey.export({ type: "spki", format: "pem" }));
    console.log(`[host] clé ed25519 générée : ${privPath} (privée, secrète) + ${pubOut} (publique → HOUETOR_TRUST_KEYS)`);
    break;
  }

  case "sign": {
    // Exp 016 : signe manifest.json (octets bruts) → manifest.sig
    const [dir, privKeyPath] = rest;
    if (!dir || !privKeyPath) die("usage : sign <dossier-plugin> <clé-privée.pem>");
    const mPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(mPath)) die(`${dir} : manifest.json introuvable`);
    let priv;
    try {
      priv = crypto.createPrivateKey(fs.readFileSync(privKeyPath));
    } catch (e) {
      die(`clé privée illisible (${privKeyPath}) : ${e.message}`);
    }
    const sig = crypto.sign(null, fs.readFileSync(mPath), priv);
    fs.writeFileSync(path.join(dir, "manifest.sig"), JSON.stringify({ alg: "ed25519", sig: sig.toString("base64") }, null, 2) + "\n");
    console.log(`[host] signé (ed25519) : ${path.join(dir, "manifest.sig")}`);
    break;
  }

  default:
    die("usage : host.mjs <list|info|run|bench|install|install-url|remove|registry|hash|keygen|sign|wit|types> [args...]");
}
