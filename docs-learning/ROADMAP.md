# ROADMAP — Étude architecture universelle de plugins WASM

> Statut mis à jour à chaque session. Détail des phases : `etude_wasm_plugins.md` §6.

| Phase | Objectif | Statut | Dernier point |
|---|---|---|---|
| **1 — État de l'art** | WASM → WASI → Component Model → WIT → Runtimes → Plugins ; niveau de maturité | ✅ **FAITE** (2026-10-04) | `phase1_etat_de_l_art.md` — Exp 001 |
| **2 — Cartographie** | Répertorier les systèmes utilisant WASM (8 domaines A–H, y compris échecs) | ✅ **FAITE** (2026-10-04) | `phase2_cartographie.md` — sources datées, synthèse : 8 contrats hétérogènes |
| **3 — Prototype** | **HOUETOR Plugin Host** : découvrir, valider, charger, permissions, appeler, retirer, versionner, mettre à jour + comparatif §8 | ✅ **MVP + MESURES FAITS** (2026-10-04) | `prototype/host/host.mjs` + `phase3_measures.md` — Exp 003/004 |
| **4 — WASM × MCP** | Pont `Plugin WASM → WASM Host → MCP Bridge → Agent IA` : manifeste → outils automatiquement | ✅ **POC FAIT** (2026-10-04, test 8/8) | `prototype/mcp/bridge.mjs` + `phase4_mcp_bridge.md` — Exp 005 |

## État Phase 3 (détail)

**Fait :** découverte, validation manifeste, chargement (compile+instantiate mesurés), **deny-by-default** (refus `env.host_log` + refus permission non accordée), appels mesurés, retrait, installation versionnée (`.history/`), mise à jour sans toucher au host, refus de version dupliquée, **comparatif §8 4 jambes** (natif 19,2 ns · WASM 70,7 ns · JS 112,3 ns · Python 5 718 ns par appel).

**Reste (suite, non bloquant) :** WASI 0.2 réel (capabilities fichier/réseau via wasmtime), échanges avec chaînes/structs (WIT), signature/provenance des plugins, jambe **wasmtime CLI** du bench (isoler le RSS du runtime sans Node), portabilité multi-runtimes.

## État Phase 4 (détail)

**Fait :** bridge MCP stdio sans dépendance, découverte auto des plugins, `tools/list` **généré depuis les manifestes**, `tools/call` routé vers le host, refus des outils inconnus, **défense en profondeur** prouvée (outil exposé mais appel refusé par sandbox).
**Reste :** vrai client MCP externe (inspector/Claude Desktop), types riches (WIT), filtrage d'outils par policy.

## Critères de mesure (étude §7) — couverture finale

| Critère | Couvert ? | Preuve |
|---|---|---|
| Temps de chargement | ✅ | Exp 003/004 (cold load 4,2 ms WASM) |
| Temps d'exécution | ✅ | Exp 004 (19,2 / 70,7 / 112,3 / 5 718 ns) |
| Mémoire utilisée | ✅ | Exp 004 (RSS 3,6 / 16 / 41 MB + 1 Mo mémoire WASM) |
| Taille du plugin | ✅ | Exp 004 (160 o vs 88 064 o natif) |
| Isolation | ✅ | Exp 003/005 (deny-by-default, 2 barrières) |
| Niveau de contrôle des permissions | ✅ | Exp 003 (manifeste ∩ allow-list hôte) |
| Temps d'installation | 🟡 | non chronométré (fs local, ms) — à instrumenter |
| Temps de mise à jour | 🟡 | idem |
| Portabilité | 🟡 | même `hello.wasm` sur Node ici ; sous wasmtime/Firefox = suite |
| Complexité d'intégration | ✅ | hôte ≈ 250 lignes JS, 0 dépendance ; bridge ≈ 150 lignes, 0 dépendance |
| Facilité de retrait | ✅ | Exp 003 (`remove`) |
| Gestion des versions | ✅ | Exp 003 (`.history/`, refus doublon) |
| Gestion des dépendances | 🟡 | imports hôtes refusés sauf permissions ; WIT/composants = suite |

## Comparaison expérimentale (étude §8)

✅ Réalisée (2026-10-04) : natif / Python / JS / WASM → `phase3_measures.md` + `prototype/bench/results.json` (script reproductible `run_bench.mjs`, médiane de 5 spawns).

## Pont MCP × WASM (étude §5)

✅ Réalisé (2026-10-04) : `prototype/mcp/bridge.mjs`, test 8/8, `phase4_mcp_bridge.md`.

## Blocages actuels

- Aucun bloquant : outillage complet (Rust, wasmtime, Node, clang-MinGW, Python).
- Suites ouvertes (non bloquantes) : leg wasmtime du bench, WIT/Component Model, client MCP externe, questions finales §11 de l'étude.
