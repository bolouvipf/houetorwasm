# ROADMAP — Étude architecture universelle de plugins WASM

> Statut mis à jour à chaque session. Détail des phases : `etude_wasm_plugins.md` §6.

| Phase | Objectif | Statut | Dernier point |
|---|---|---|---|
| **1 — État de l'art** | WASM → WASI → Component Model → WIT → Runtimes → Plugins ; niveau de maturité | ✅ **FAITE** (2026-10-04) | `phase1_etat_de_l_art.md` — Exp 001 |
| **2 — Cartographie** | Répertorier les systèmes utilisant WASM (8 domaines A–H, y compris échecs) | ✅ **FAITE** (2026-10-04) | `phase2_cartographie.md` — sources datées, synthèse : 8 contrats hétérogènes |
| **3 — Prototype** | **HOUETOR Plugin Host** : découvrir, valider, charger, permissions, appeler, retirer, versionner, mettre à jour + comparatif §8 + comparaison Extism | ✅ **MVP + MESURES FAITS** (2026-10-04) | `prototype/host/host.mjs` + `phase3_measures.md` — Exp 003→021 |
| **4 — WASM × MCP** | Pont `Plugin WASM → WASM Host → MCP Bridge → Agent IA` : manifeste → outils automatiquement | ✅ **POC FAIT** (2026-10-04, test 8/8 + outils typés) | `prototype/mcp/bridge.mjs` + `phase4_mcp_bridge.md` — Exp 005, 015, 019 |
| **Conclusion §11** | Répondre aux 8 questions finales + verdict hypothèse §9 | ✅ **ÉCRITE** (2026-10-04) | `conclusion.md` (preuves Exp 001→021) |

## État Phase 3 (détail)

**Fait :** découverte, validation manifeste, chargement (compile+instantiate mesurés), **deny-by-default**, appels mesurés, retrait, installation versionnée (`.history/`), mise à jour sans toucher au host, refus de version dupliquée, **comparatif §8 à 5 jambes** (Exp 006+009 : campagne canonique natif 7,2 · wasmtime 13,9 · WASM-Node 24,5 · JS 34,3 · Python 1 594 ns/appel ; **ratios stables sur 5 campagnes** : wasmtime ≈ natif ×1,5 [0,6-1,9], host 1,4-2,2× JS, Python 65-238×) + **RSS pic externe** (`peak_rss.ps1` : wasmtime 14,4 Mo / wazero 16,1 Mo vs Node 40,5 Mo) + **portabilité multi-OS** (Exp 007+010 : même binaire, 2 OS, 4 exécuteurs, 3 moteurs, résultat identique) + **cycle de vie chronométré** (Exp 008 : install 18,5 ms · update 24,7 ms · remove 14,2 ms fs net) + **stabilité du banc** (Exp 009 : ratios stables, fourchettes publiées) + **capabilities fichier WASI** (Exp 011 : lecture, grant/escape/nogrant × 3 moteurs, 9/9 ; Exp 012 : écriture rw/hors-preopen/ro, 21 checks + hôte) + **distribution** (Exp 013 : registre `registry` + `install-url` HTTP, 11/11 checks, install 224 ms) + **intégrité** (Exp 014 : épinglage sha256 obligatoire à distance, vérifié à chaque chargement, altération détectée, 15/15 checks) + **provenance** (Exp 016 : signature Ed25519 `manifest.sig` + `HOUETOR_TRUST_KEYS`, install distant = sha256 + sig, 12/12 checks) + **composants WIT** (Exp 018 : plugin `witcalc` — WIT et capabilities lus dans le binaire, exécution WAVE, refus de type/arité avant exécution, deny-by-default statique fs, 20/20 checks) + **isolation temporelle** (Exp 020 : `HOUETOR_FUEL`/`HOUETOR_TIMEOUT` — plugin malveillant 60,2 s → coupé en 313 ms, fail-closed, 12/12 checks) + **comparaison Extism** (Exp 021 : CLI 1.6.3 + PDK, mêmes verdicts de sécurité mais contrats incompatibles, 11/11 checks → thèse C confirmée sur un tiers).

**Reste (suite, non bloquant) :** WASI **réseau** (sockets), plafond **mémoire** (`max-memory-size`), portabilité macOS/navigateur, hôte wasmtime Rust.

## État Phase 4 (détail)

**Fait :** bridge MCP stdio sans dépendance, découverte auto des plugins, `tools/list` **généré depuis les manifestes**, `tools/call` routé vers le host, refus des outils inconnus, **défense en profondeur** prouvée (outil exposé mais appel refusé par sandbox), **filtrage par policy** (Exp 015 : allow/deny, deny prioritaire, fail-closed, 9/9), **outils typés** (Exp 019 : pour un composant, `inputSchema` à propriétés nommées typées issues du WIT `{a: number, b: number}`, `tools/call` nommé → positionnel + refus paramètre manquant ; modules core = schéma legacy ; régressions 8/8 + 9/9).
**Reste :** vrai client MCP externe (inspector/Claude Desktop), `resource`/`variant` WIT dans les schémas.

## Critères de mesure (étude §7) — couverture finale

| Critère | Couvert ? | Preuve |
|---|---|---|
| Temps de chargement | ✅ | Exp 003/004 (cold load 4,2 ms WASM) |
| Temps d'exécution | ✅ | Exp 004 (19,2 / 70,7 / 112,3 / 5 718 ns) |
| Mémoire utilisée | ✅ | Exp 004 (RSS 3,6 / 16 / 41 MB + 1 Mo mémoire WASM) |
| Taille du plugin | ✅ | Exp 004 (160 o vs 88 064 o natif) |
| Isolation | ✅ | Exp 003/005 (deny-by-default, 2 barrières) ; **Exp 018** (fs deny statique lisible dans le binaire) ; **Exp 020** (fuel + timeout : DoS 60,2 s → 313 ms) |
| Niveau de contrôle des permissions | ✅ | Exp 003 (manifeste ∩ allow-list hôte) + Exp 018 (`HOUETOR_PREOPENS` : montages fichiers explicites, double verrou) |
| Temps d'installation | ✅ | Exp 008 (18,5 ms fs net + spawn host) |
| Temps de mise à jour | ✅ | Exp 008 (24,7 ms : v1→v2 + archive `.history`) ; Exp 013 : install distante 224 ms |
| Portabilité | ✅ | même fichier → **2 OS (Windows + Linux/WSL2), 7 combinaisons** exécuteur×OS, **3 moteurs indépendants** (wasmtime-Cranelift p1+p2, wazero-Go, node:wasi-V8), même résultat (Exp 007+010 : `portability.json` + `portability_os.json`) ; macOS/navigateur = suite |
| Complexité d'intégration | ✅ | hôte ≈ 725 lignes JS, 0 dépendance ; bridge ≈ 229 lignes, 0 dépendance |
| Facilité de retrait | ✅ | Exp 003 (`remove`) |
| Gestion des versions | ✅ | Exp 003 (`.history/`, refus doublon) |
| Gestion des dépendances | ✅ | imports hôtes refusés sauf permissions (Exp 003) ; **surface d'imports lue DANS le binaire** + refus statique si non déclarée (Exp 018) ; WIT = contrat de dépendances inspectable |

## Comparaison expérimentale (étude §8)

✅ Réalisée (2026-10-04, **5 jambes**) : natif / Python / JS / WASM-host / WASM-wasmtime → `phase3_measures.md` + `prototype/bench/results.json` + `peak_rss.json` (scripts `run_bench.mjs`, `peak_rss.ps1`, médianes).

## Pont MCP × WASM (étude §5)

✅ Réalisé (2026-10-04) : `prototype/mcp/bridge.mjs`, test 8/8, `phase4_mcp_bridge.md`.

## Conclusion §11 (8 questions + hypothèse §9)

✅ Écrite (2026-10-04) : `conclusion.md` — hypothèse **confirmée côté technique, nuancée côté écosystème**.

## Blocages actuels

- Aucun bloquant : outillage complet (Rust, wasmtime, Node, wit-bindgen, wasm-tools, clang-MinGW, Python), 4 phases + conclusion livrées.
- Suites ouvertes (non bloquantes) : portabilité macOS/navigateur, WASI réseau, plafond mémoire, client MCP externe (inspector), charge de fichiers WASI réelle.
