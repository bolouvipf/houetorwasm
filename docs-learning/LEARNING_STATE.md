# LEARNING_STATE — État actuel et point de reprise

> Dernière mise à jour : **2026-10-04** (session 1 — fin de session)

## Fait ✅

1. **Phase 1 — État de l'art livrée** → `phase1_etat_de_l_art.md` (sources datées, matrice de maturité 13 lignes).
   - **Conclusion** : propriétés *mécaniques* ✅ / propriétés *écosystémiques* ❌ → terrain du prototype.
2. **Phase 2 — Cartographie livrée** → `phase2_cartographie.md` (8 domaines A–H, sources vérifiées le 2026-10-04).
   - **Conclusion** : **8 contrats hétérogènes** pour un format « universel » — la question C est confirmée ; Docker Wasm abandonné 🔴, APISIX WASM gelé 🟡, adoption web réelle 0,35 %.
3. **Phase 3 — HOUETOR Plugin Host + mesures** → `prototype/host/host.mjs` + `phase3_measures.md`.
   - **8/8 étapes du §4** (Exp 003) ; **comparatif §8 à 5 jambes** (Exp 004+006) : natif **17,8** · wasmtime **27,2** · WASM-Node **59,9** · JS **80,5** · Python **4 127,6** ns/appel ; RSS pic : wasmtime **13,7 Mo** vs Node **41,4 Mo** (Exp 006) ; plugin **160 o**, cold load **~2 ms**.
4. **Phase 4 — Pont MCP** → `prototype/mcp/bridge.mjs` + `phase4_mcp_bridge.md`.
   - **8/8** (Exp 005) : `tools/list` **généré automatiquement depuis les manifestes** ; défense en profondeur (outil exposé, appel refusé par sandbox).
5. **Conclusion §11 écrite** → `conclusion.md` : réponses aux 8 questions + verdict hypothèse §9 (**confirmée côté technique, nuancée côté écosystème**).
6. **Structure lab** : `AGENTS.md`, `docs-learning/{ROADMAP,LEARNING_STATE,EXPERIMENTS_LOG}.md` (Exp 001→006).
7. **Repo GitHub** : `https://github.com/bolouvipf/houetorwasm.git` — tout poussé (dernier commit de session : docs + conclusion).
8. **Toolchain** : wasmtime 49.0.2 · Rust 1.99.0 (+ wasm32) · Node 24.15.0 · Python 3.14 · **clang/LLVM-MinGW 22.1.8** · GPU inutile (tranché).

## À faire ⏳ (suite recommandée, par ordre)

1. **Portabilité 3ᵉ runtime** : rejouer une charge sous un runtime/OS différent (navigateur, Linux) → critère portabilité ✅ complet.
2. **WASI 0.2 réel** : capabilities fichier/réseau + **WIT** (chaînes/structs) pour enrichir le bridge MCP (types d'outils riches).
3. Client MCP externe (inspector/Claude Desktop) contre `bridge.mjs` ; filtrage d'outils par policy.
4. Instrumenter temps d'installation / mise à jour (§7) ; workload non compute-bound (strings/mémoire).
5. Éventuellement : signature/provenance des plugins, hôte wasmtime en Rust.

## Point de reprise exact

> Les **4 phases + conclusion sont livrées**. Reprendre une **suite** (étape 1 ci-dessus) ou une révision.
> Vérifier l'outillage : `wasmtime --version ; cargo --version ; node --version` (**chemins absolus si shell ancien** : `%USERPROFILE%\.cargo\bin\cargo.exe`, `~\.local\bin\wasmtime-*\wasmtime.exe`).
> Reprendre le fil : `AGENTS.md` §3 → `ROADMAP.md` → `EXPERIMENTS_LOG.md` (dernier : **Exp 006**) → `conclusion.md`.
> Recommandé avant toute reprise : `node prototype\mcp\test_bridge.mjs` (8/8) + `node prototype\bench\run_bench.mjs` (5 jambes).

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
