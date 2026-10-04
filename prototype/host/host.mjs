#!/usr/bin/env node
// HOUETOR Plugin Host — MVP (Phase 3)
// Cycle de vie : discover -> validate manifest -> load (deny-by-default) -> call -> bench -> install -> remove -> registry
// Usage : node host.mjs <list|info|run|bench|install|install-url|remove|registry> [...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url)); // prototype/host
const PLUGINS = path.resolve(ROOT, "..", "plugins");
const HOST_ALLOWED = []; // deny-by-default : aucune capability accordée par défaut

const die = (msg, code = 1) => {
  console.error("[host] ERREUR : " + msg);
  process.exit(code);
};
const now = () => performance.now();

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
  return { dir, manifest: raw, wasmPath, permissions: perms };
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
        }]`
      );
    break;
  }

  case "info": {
    const p = loadManifest(rest[0] ?? die("usage : info <plugin>"));
    const bytes = fs.readFileSync(p.wasmPath);
    const mod = await WebAssembly.compile(bytes);
    console.log(JSON.stringify({
      manifest: p.manifest,
      disk_size: bytes.length,
      imports: WebAssembly.Module.imports(mod),
      exports: WebAssembly.Module.exports(mod).map((e) => e.kind + ":" + e.name),
    }, null, 2));
    break;
  }

  case "run": {
    const [name, fn, ...args] = rest;
    if (!name || !fn) die("usage : run <plugin> <fonction> [args...]");
    const p = loadManifest(name);
    if (!p.manifest.exports.includes(fn)) die(`${name} : fonction "${fn}" non déclarée dans le manifeste`);
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
    doInstall(src, srcManifest);
    break;
  }

  case "install-url": {
    // Registre distant : <base>/manifest.json + <base>/<wasm> (HTTP(S) ou file://)
    const base = rest[0];
    if (!base) die("usage : install-url <baseURL>   (ex. http://127.0.0.1:5099/regprobe/1.0.1)");
    let manifest;
    try {
      const res = await fetch(new URL("manifest.json", base));
      if (!res.ok) die(`install-url : manifest.json inaccessible (HTTP ${res.status})`);
      manifest = await res.json();
    } catch (e) {
      die(`install-url : échec du téléchargement du manifeste (${e.message})`);
    }
    precheckManifest(manifest, `${base} (manifeste distant)`);
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
    // chemin wasm exact du manifeste (sous-dossiers possibles)
    const wasmDest = path.join(staging, String(manifest.wasm));
    fs.mkdirSync(path.dirname(wasmDest), { recursive: true });
    fs.writeFileSync(wasmDest, Buffer.from(await wRes.arrayBuffer()));
    fs.writeFileSync(path.join(staging, "manifest.json"), JSON.stringify(manifest, null, 2));
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

  default:
    die("usage : host.mjs <list|info|run|bench|install|install-url|remove|registry> [args...]");
}
