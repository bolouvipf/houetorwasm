# ROADMAP — Étude architecture universelle de plugins WASM

> Statut mis à jour à chaque session. Détail des phases : `etude_wasm_plugins.md` §6.

| Phase | Objectif | Statut | Dernier point |
|---|---|---|---|
| **1 — État de l'art** | WASM → WASI → Component Model → WIT → Runtimes → Plugins ; niveau de maturité | ✅ **FAITE** (2026-10-04) | `phase1_etat_de_l_art.md` — Exp 001 |
| **2 — Cartographie** | Répertorier les systèmes utilisant WASM (plugins, extensions, sandbox, cloud, edge, IA, composants, embarqué) ; où ça marche / où ça bloque | 🔄 **EN COURS** (squelette A-B-E-F rempli en partie) | `phase2_cartographie.md` |
| **3 — Prototype** | **HOUETOR Plugin Host** : découvrir, vérifier manifeste, charger, permissions, appeler, retirer, versionner, mettre à jour | 🟡 **MVP FAIT** (2026-10-04) — 8/8 étapes §4 démontrées | `prototype/host/host.mjs` — Exp 003 |
| **4 — WASM × MCP** | Pont `Plugin WASM → WASM Host → MCP Bridge → Agent IA` | ⬜ Pas commencée | — |

## État Phase 3 (détail)

**Fait :** découverte, validation manifeste, chargement (compile+instantiate mesurés), **deny-by-default** (refus `env.host_log` + refus permission non accordée), appels mesurés, retrait, installation versionnée (archive `.history/`), mise à jour sans toucher au host, refus de version dupliquée.

**Reste :** WASI 0.2 réel (capabilities fichier/réseau), échanges avec chaînes/structs, signature/provenance, comparatif §8 (natif/Python/JS/WASM), hôte wasmtime (Rust).

## Critères de mesure (étude §7) — couverture MVP

| Critère | Couvert ? |
|---|---|
| Temps de chargement | ✅ (cold load / compile / instantiate) |
| Temps d'exécution | ✅ (call_avg_ms) |
| Mémoire utilisée | ✅ (memory_bytes) |
| Taille du plugin | ✅ (wasm_bytes) |
| Isolation | ✅ (deny-by-default, refus d'imports) |
| Niveau de contrôle des permissions | ✅ (manifeste ↔ allow-list hôte) |
| Temps d'installation | ⬜ à mesurer |
| Temps de mise à jour | ⬜ à mesurer |
| Portabilité | 🟡 (mêmes binaires = doc, à démontrer) |
| Complexité d'intégration | ⬜ à évaluer (Phase 3 suite) |
| Facilité de retrait | ✅ (remove) |
| Gestion des versions | ✅ (`.history/`, refus doublon) |
| Gestion des dépendances | ⬜ (WIT/composants — Phase 3 suite) |

## Comparaison expérimentale (étude §8)

Une même fonctionnalité implémentée 4 fois : **natif VS Python VS JavaScript VS WASM** → `phase3_measures.md` (à créer).

## Blocages actuels

- Aucun bloquant outillage (Rust + wasmtime + Node OK).
- Phase 2 : domaines C à H à remplir (recherche web).
- Phase 4 : nécessite le pont MCP (décision : hôte Node ou Rust ?).
