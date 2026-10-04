#!/usr/bin/env node
// Phase 4 (étude §5) — MCP Bridge : Plugin WASM → WASM Host → MCP Bridge → Agent IA
// Démonstration : les exports déclarés au manifeste des plugins deviennent AUTOMATIQUEMENT
// des outils MCP (question expérimentale : « un composant WASM peut-il être transformé
// automatiquement en outil MCP ? »).
// Transport MCP : stdio, JSON-RPC 2.0, messages délimités par newlines (aucune dépendance).
// Usage : node bridge.mjs   (par un client MCP via stdin/stdout)
//   HOUETOR_MCP_POLICY=<fichier.json {"allow":[],"deny":[]}>  → filtrage d'outils (Exp 015)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // prototype/mcp
const HOST = path.resolve(HERE, "..", "host", "host.mjs");
const SERVER_INFO = { name: "houetor-mcp-bridge", version: "0.1.0" };
const PROTOCOL_VERSION = "2025-06-18";

// --- Policy d'outils (Exp 015) : HOUETOR_MCP_POLICY = chemin d'un JSON {allow:[...], deny:[...]}
// Sans variable → mode "open" (rétro-compatible). Fichier illisible/ invalide → "fail-closed"
// (rien exposé, tout refusé) : un défaut de configuration ne doit jamais ouvrir l'accès.
const POLICY_PATH = process.env.HOUETOR_MCP_POLICY || null;
let policyCache = null;
function loadPolicy() {
  if (policyCache) return policyCache;
  if (!POLICY_PATH) return (policyCache = { mode: "open" });
  try {
    const raw = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
    return (policyCache = {
      mode: "filter",
      allow: new Set(Array.isArray(raw.allow) ? raw.allow : []),
      deny: new Set(Array.isArray(raw.deny) ? raw.deny : []),
      src: POLICY_PATH,
    });
  } catch (e) {
    return (policyCache = { mode: "fail-closed", reason: e.message, src: POLICY_PATH });
  }
}
function policyAllows(toolName) {
  const p = loadPolicy();
  if (p.mode === "open") return true;
  if (p.mode === "fail-closed") return false;
  if (p.deny.has(toolName)) return false; // deny prime sur allow
  return p.allow.has(toolName);
}
function policyStatus(toolName) {
  const p = loadPolicy();
  if (p.mode === "fail-closed") return `policy fail-closed (${p.src} illisible : ${p.reason})`;
  if (p.deny.has(toolName)) return `tool « ${toolName} » refusé par policy (deny, ${p.src})`;
  return `tool « ${toolName} » refusé par policy (hors allow, ${p.src})`;
}

const hostRun = (args) =>
  spawnSync(process.execPath, [HOST, ...args], { encoding: "utf8", timeout: 30_000 });

// --- Découverte : le host reste la source de vérité (manifestes validés, deny-by-default) ---
function discoverPlugins() {
  const r = hostRun(["list"]);
  if (r.status !== 0) return [];
  const out = [];
  for (const line of (r.stdout ?? "").trim().split(/\r?\n/).filter(Boolean)) {
    const m = line.match(/^(\S+)@(\S+)\s+size=(\d+)B\s+exports=\[([^\]]*)\]\s+perms=\[([^\]]*)\]/);
    if (m)
      out.push({
        name: m[1],
        version: m[2],
        size: Number(m[3]),
        exports: m[4].split(",").map((s) => s.trim()).filter(Boolean),
        permissions: m[5].split(",").map((s) => s.trim()).filter(Boolean),
        type: /type=component/.test(line) ? "component" : "module",
      });
  }
  return out;
}

// --- Signatures typées lues par le host DANS le composant (Exp 018/019) ---
const WIT_TO_JSON = {
  f32: "number", f64: "number",
  u8: "integer", u16: "integer", u32: "integer", u64: "integer",
  s8: "integer", s16: "integer", s32: "integer", s64: "integer",
  bool: "boolean", char: "string", string: "string",
};
function componentFunctions(pluginName) {
  const r = hostRun(["types", pluginName]);
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout).functions ?? null;
  } catch {
    return null;
  }
}

// --- Génération automatique outils MCP depuis les manifestes ---
// applyPolicy=false : vue complète (pour distinguer « inconnu » de « refusé par policy » à l'appel)
function buildTools({ applyPolicy = true } = {}) {
  const tools = [];
  for (const p of discoverPlugins()) {
    const sigs = p.type === "component" ? componentFunctions(p.name) : null;
    for (const fn of p.exports) {
      const name = `${p.name}_${fn}`;
      if (applyPolicy && !policyAllows(name)) continue;
      const sig = sigs?.[fn];
      const inputSchema = sig
        ? {
            // Composant WIT : paramètres NOMMÉS et TYPÉS (lus dans le binaire)
            type: "object",
            properties: Object.fromEntries(
              sig.params.map((prm) => [
                prm.name,
                { type: WIT_TO_JSON[prm.type] ?? "string", description: `paramètre WIT \`${prm.name}: ${prm.type}\`` },
              ])
            ),
            required: sig.params.map((prm) => prm.name),
          }
        : {
            // Module core : ABI maison sans typage (number[])
            type: "object",
            properties: {
              args: {
                type: "array",
                items: { type: "number" },
                description: "Arguments positionnels (nombres) passés à la fonction WASM",
                default: [],
              },
            },
            required: [],
          };
      tools.push({
        name,
        description: sig
          ? `Composant WASM ${p.name}@${p.version} — ${sig.params
              .map((prm) => `${prm.name}: ${prm.type}`)
              .join(", ") || "aucun paramètre"} → ${sig.returns || "void"} (interface WIT lue dans le binaire ; WASI deny-by-default, permissions : ${
              p.permissions.join(", ") || "aucune"
            })`
          : `Plugin WASM ${p.name}@${p.version} — fonction exportée « ${fn} » ` +
            `(découverte automatique depuis manifest.json ; sandbox deny-by-default, ` +
            `permissions accordées : ${p.permissions.join(", ") || "aucune"})`,
        inputSchema,
        _plugin: p.name,
        _fn: fn,
        _params: sig ? sig.params : null,
      });
    }
  }
  return tools;
}

const text = (s) => ({ content: [{ type: "text", text: s }] });

function handle(req) {
  const { id, method, params } = req;
  const hasId = id !== undefined;
  const result = (() => {
    switch (method) {
      case "initialize":
        return {
          protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        };
      case "notifications/initialized":
      case "notifications/cancelled":
        return null; // pas de réponse
      case "ping":
        return {};
      case "tools/list":
        return {
          tools: buildTools().map(({ _plugin, _fn, _params, ...t }) => t), // champs internes masqués
        };
      case "tools/call": {
        // vue complète : un outil existe (manifeste) mais peut être filtré par policy
        const all = buildTools({ applyPolicy: false });
        const tool = all.find((t) => t.name === params?.name);
        if (!tool) return { content: [{ type: "text", text: `outil inconnu : ${params?.name}` }], isError: true };
        if (!policyAllows(tool.name))
          return { content: [{ type: "text", text: policyStatus(tool.name) }], isError: true };
        let args;
        if (tool._params) {
          // Composant WIT : arguments NOMMÉS (selon l'inputSchema) → positionnels, types contrôlés par le host
          args = [];
          for (const prm of tool._params) {
            const v = params?.arguments?.[prm.name];
            if (v === undefined)
              return { content: [{ type: "text", text: `paramètre manquant : ${prm.name} (${prm.type})` }], isError: true };
            if (prm.type === "string" && typeof v !== "string")
              return { content: [{ type: "text", text: `paramètre ${prm.name} : attendu string, reçu ${typeof v}` }], isError: true };
            args.push(typeof v === "string" ? v : String(v));
          }
        } else {
          args = Array.isArray(params?.arguments?.args) ? params.arguments.args.map(String) : [];
        }
        const r = hostRun(["run", tool._plugin, tool._fn, ...args]);
        const ok = r.status === 0;
        return {
          content: [{ type: "text", text: (ok ? r.stdout : r.stderr).trim() }],
          ...(ok ? {} : { isError: true }),
        };
      }
      default:
        return hasId ? { error: { code: -32601, message: `method not found : ${method}` } } : null;
    }
  })();
  if (!hasId || result === null) return null;
  if (result && result.error) return { jsonrpc: "2.0", id, error: result.error };
  return { jsonrpc: "2.0", id, result };
}

// --- Boucle stdin : une requête JSON-RPC par ligne ---
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let resp = null;
    try {
      resp = handle(JSON.parse(line));
    } catch (e) {
      resp = { jsonrpc: "2.0", id: null, error: { code: -32700, message: `parse error : ${e.message}` } };
    }
    if (resp) process.stdout.write(JSON.stringify(resp) + "\n");
  }
});
process.stdin.on("end", () => process.exit(0));
