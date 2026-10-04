# ROADMAP — Étude architecture universelle de plugins WASM

> Statut mis à jour à chaque session. Détail des phases : `etude_wasm_plugins.md` §6.

| Phase | Objectif | Statut | Dernier point |
|---|---|---|---|
| **1 — État de l'art** | WASM → WASI → Component Model → WIT → Runtimes → Plugins ; niveau de maturité | ✅ **FAITE** (2026-10-04) | `phase1_etat_de_l_art.md` — Exp 001 |
| **2 — Cartographie** | Répertorier les systèmes utilisant WASM (plugins, extensions, sandbox, cloud, edge, IA, composants, embarqué) ; où ça marche / où ça bloque | 🔄 **EN COURS** | `phase2_cartographie.md` (squelette) |
| **3 — Prototype** | Construire le **HOUETOR Plugin Host** (`/plugins/*.wasm`) : découvrir, vérifier manifeste, charger, permissions, appeler, retirer, versionner, mettre à jour | ⬜ Pas commencée | — |
| **4 — WASM × MCP** | Pont `Plugin WASM → WASM Host → MCP Bridge → Agent IA` ; un composant WASM devient-il automatiquement un outil MCP ? | ⬜ Pas commencée | — |

## Critères de mesure (Phase 3, étude §7)

Temps de chargement · temps d'exécution · mémoire · taille du plugin · isolation · niveau de contrôle des permissions · temps d'installation · temps de mise à jour · portabilité · complexité d'intégration · facilité de retrait · gestion des versions · gestion des dépendances.

## Comparaison expérimentale (étude §8)

Une même fonctionnalité implémentée 4 fois : **natif VS Python VS JavaScript VS WASM**, mesurée sur les mêmes critères.

## Blocages actuels

- Outillage local absent (Rust, wasmtime) → bloquant pour Phase 3.
- Réponses non traitées (fin de l'étude §11) → à remplir en fin de parcours.
