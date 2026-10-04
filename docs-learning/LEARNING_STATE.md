# LEARNING_STATE — État actuel et point de reprise

> Dernière mise à jour : **2026-10-04** (session 1 — fin de session)

## Fait ✅

1. **Phase 1 — État de l'art livrée** → `phase1_etat_de_l_art.md` (sources datées, matrice de maturité 13 lignes).
   - **Conclusion** : propriétés *mécaniques* ✅ / propriétés *écosystémiques* ❌ → terrain du prototype.
2. **Phase 2 — Cartographie livrée** → `phase2_cartographie.md` (8 domaines A–H, sources vérifiées le 2026-10-04).
   - **Conclusion** : **8 contrats hétérogènes** pour un format « universel » — la question C est confirmée ; Docker Wasm abandonné 🔴, APISIX WASM gelé 🟡, adoption web réelle 0,35 %.
3. **Phase 3 — HOUETOR Plugin Host + mesures** → `prototype/host/host.mjs` + `phase3_measures.md`.
   - **8/8 étapes du §4** (Exp 003) ; **comparatif §8 4 jambes** (Exp 004) : natif **19,2 ns** · WASM **70,7 ns** · JS **112,3 ns** · Python **5 718 ns**/appel ; WASM = artefact **160 o**, cold load **4,2 ms**.
4. **Phase 4 — Pont MCP** → `prototype/mcp/bridge.mjs` + `phase4_mcp_bridge.md`.
   - **8/8** (Exp 005) : `tools/list` **généré automatiquement depuis les manifestes** ; défense en profondeur (outil exposé, appel refusé par sandbox).
5. **Structure lab** : `AGENTS.md`, `docs-learning/{ROADMAP,LEARNING_STATE,EXPERIMENTS_LOG}.md` (Exp 001→005).
6. **Repo GitHub** : `https://github.com/bolouvipf/houetorwasm.git` — commits `6784a11` → `e3a8e0a` (+ ceux de fin de session), tout poussé.
7. **Toolchain** : wasmtime 49.0.2 · Rust 1.99.0 (+ wasm32) · Node 24.15.0 · Python 3.14 · **clang/LLVM-MinGW 22.1.8** (Exp 004) · GPU inutile (tranché).

## À faire ⏳ (suite recommandée, par ordre)

1. **Questions finales §11** de l'étude (les 8 questions) → document de conclusion.
2. **Jambe wasmtime du bench** : isoler le RSS du runtime WASM sans Node (actuellement 41 MB = Node).
3. **Portabilité** : rejouer `hello.wasm` sous wasmtime (runtime différent de V8).
4. **WASI 0.2 réel** : capabilities fichier/réseau + hôte wasmtime (Rust) ; **WIT** pour types riches (chaînes/structs).
5. Client MCP externe (inspector) contre `bridge.mjs` ; filtrage d'outils par policy.
6. Instrumenter temps d'installation / mise à jour (§7).

## Point de reprise exact

> Reprendre à **l'étape 1** (questions §11 → `conclusion.md`) ou **étape 2** (bench wasmtime).
> Vérifier l'outillage : `wasmtime --version ; cargo --version ; node --version` (PATH user).
> Reprendre le fil : `AGENTS.md` §3 (état) → `ROADMAP.md` (statuts) → `EXPERIMENTS_LOG.md` (dernier : **Exp 005**).
> Code : `node prototype\mcp\test_bridge.mjs` (8/8 attendus) et `node prototype\bench\run_bench.mjs` (4 jambes).

## Décisions de session

- **2026-10-04** : GPU inutile (travail CPU/RAM) ; accélération = toolchain locale + recherches web.
- **2026-10-04** : logiciel étudié en Phase 3 = **celui que nous créons** (HOUETOR Plugin Host), conformément au document source.
- **2026-10-04** : hôte MVP en **Node** (zéro build) ; wasmtime reste l'arme pour WASI + capabilities réelles.
- **2026-10-04** : source du plugin rangée dans `plugins/<nom>/` (`target/` ignoré par git, `fib_native.exe` ignoré aussi).
- **2026-10-04** : bridge MCP = **client pur du host** (spawn `host.mjs`) — sécurité centralisée dans le host, bridge = couplage de protocole seul.
- **2026-10-04** : pour le bench §8, K différent par jambe mais **`per_call_ns` normalisé** ; `sink`/accumulateur obligatoire (bug dead-code corrigé, Exp 004).

## Reste connu (mineur)

- `prototype/plugins/hello/target/` : build résiduel (ignoré par git).
- `prototype/samples/{hello-v2,needy}/` : sources servant à `install` (needy : `-C link-arg=--allow-undefined` requis).
- `needy` reste installé (utile pour retester la défense en profondeur ; retirer avec `host.mjs remove needy`).
