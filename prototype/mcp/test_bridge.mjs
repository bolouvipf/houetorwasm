#!/usr/bin/env node
// Test du pont Phase 4 : handshake MCP complet + découverte auto des outils + appel outil.
// Preuve brute : transcript complet écrit dans mcp/transcript.json + sortie console.
// Exit code 0 si toutes les étapes passent.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(HERE, "bridge.mjs");

const transcript = [];
let buf = "";
let pending = null;

const child = spawn(process.execPath, [BRIDGE], { stdio: ["pipe", "pipe", "inherit"] });
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    transcript.push({ dir: "← bridge", msg });
    if (pending && msg.id === pending.id) {
      const { resolve } = pending;
      pending = null;
      resolve(msg);
    }
  }
});

function send(msg) {
  transcript.push({ dir: "→ bridge", msg });
  child.stdin.write(JSON.stringify(msg) + "\n");
}
const request = (id, method, params) => {
  send({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
  return new Promise((resolve, reject) => {
    pending = { id, resolve };
    setTimeout(() => reject(new Error(`timeout sur ${method}`)), 10_000);
  });
};

const checks = [];
const check = (label, cond, detail) => {
  checks.push({ label, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
};

const init = await request(1, "initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "houetor-test-client", version: "0.1.0" },
});
check("initialize : serverInfo", init.result?.serverInfo?.name === "houetor-mcp-bridge", JSON.stringify(init.result?.serverInfo));
send({ jsonrpc: "2.0", method: "notifications/initialized" });

const tools = await request(2, "tools/list");
const names = (tools.result?.tools ?? []).map((t) => t.name).sort();
console.log("   outils générés automatiquement :", JSON.stringify(names));
const helloTools = ["hello_add", "hello_fibonacci", "hello_plugin_version"];
check(
  "tools/list auto : exports de hello → outils MCP",
  helloTools.every((n) => names.includes(n)),
  JSON.stringify(names)
);
const addTool = tools.result?.tools.find((t) => t.name === "hello_add");
check(
  "schéma JSON du tool (inputSchema)",
  addTool?.inputSchema?.type === "object",
  JSON.stringify(addTool?.inputSchema)
);

const call = await request(3, "tools/call", { name: "hello_add", arguments: { args: [2, 3.5] } });
const outText = call.result?.content?.[0]?.text ?? "";
let parsed = null;
try { parsed = JSON.parse(outText); } catch { /* reste null */ }
console.log("   sortie host :", outText.replace(/\n\s*/g, " "));
check(
  "tools/call hello_add(2, 3.5) → résultat 5.5 via host deny-by-default",
  parsed?.result === 5.5 && parsed?.plugin === "hello@1.0.1",
  `result=${parsed?.result} plugin=${parsed?.plugin}`
);
check("tools/call : pas d'erreur", call.result?.isError !== true);

const unknown = await request(4, "tools/call", { name: "does_not_exist", arguments: {} });
check(
  "outil inconnu refusé",
  unknown.result?.isError === true,
  String(unknown.result?.content?.[0]?.text).slice(0, 80)
);

// Défense en profondeur : needy_do_log EST exposé comme outil (manifeste présent),
// mais son appel échoue au host (permission env.host_log non accordée → deny-by-default).
if (names.includes("needy_do_log")) {
  const needy = await request(6, "tools/call", { name: "needy_do_log", arguments: { args: [1] } });
  check(
    "défense en profondeur : needy_do_log exposé mais REFUSÉ par le host",
    needy.result?.isError === true && /deny-by-default|refus/i.test(needy.result?.content?.[0]?.text ?? ""),
    String(needy.result?.content?.[0]?.text).slice(0, 140)
  );
}

const badMethod = await request(5, "resources/list");
check("method inconnue → -32601", badMethod.error?.code === -32601);

fs.writeFileSync(path.join(HERE, "transcript.json"), JSON.stringify(transcript, null, 2) + "\n");
child.stdin.end();

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} étapes OK → transcript.json`);
process.exit(failed.length ? 1 : 0);
