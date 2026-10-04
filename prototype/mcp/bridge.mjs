#!/usr/bin/env node
// Phase 4 (étude §5) — MCP Bridge : Plugin WASM → WASM Host → MCP Bridge → Agent IA
// Démonstration : les exports déclarés au manifeste des plugins deviennent AUTOMATIQUEMENT
// des outils MCP (question expérimentale : « un composant WASM peut-il être transformé
// automatiquement en outil MCP ? »).
// Transport MCP : stdio, JSON-RPC 2.0, messages délimités par newlines (aucune dépendance).
// Usage : node bridge.mjs   (par un client MCP via stdin/stdout)

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // prototype/mcp
const HOST = path.resolve(HERE, "..", "host", "host.mjs");
const SERVER_INFO = { name: "houetor-mcp-bridge", version: "0.1.0" };
const PROTOCOL_VERSION = "2025-06-18";

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
      });
  }
  return out;
}

// --- Génération automatique outils MCP depuis les manifestes ---
function buildTools() {
  const tools = [];
  for (const p of discoverPlugins()) {
    for (const fn of p.exports) {
      tools.push({
        name: `${p.name}_${fn}`,
        description:
          `Plugin WASM ${p.name}@${p.version} — fonction exportée « ${fn} » ` +
          `(découverte automatique depuis manifest.json ; sandbox deny-by-default, ` +
          `permissions accordées : ${p.permissions.join(", ") || "aucune"})`,
        inputSchema: {
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
        },
        _plugin: p.name,
        _fn: fn,
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
          tools: buildTools().map(({ _plugin, _fn, ...t }) => t), // champs internes masqués
        };
      case "tools/call": {
        const tool = buildTools().find((t) => t.name === params?.name);
        if (!tool) return { content: [{ type: "text", text: `outil inconnu : ${params?.name}` }], isError: true };
        const args = Array.isArray(params?.arguments?.args) ? params.arguments.args.map(Number) : [];
        const r = hostRun(["run", tool._plugin, tool._fn, ...args.map(String)]);
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
