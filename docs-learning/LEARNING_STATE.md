# LEARNING_STATE — État actuel et point de reprise

> Dernière mise à jour : **2026-10-04** (session 1)

## Fait ✅

1. **Phase 1 — État de l'art livrée** → `phase1_etat_de_l_art.md` (~300 lignes, sources datées).
   - Chaîne étudiée : WASM Core (W3C 1.0/2.0/3.0) → WASI (0.2 stable 01/2024, **0.3 du 11/06/2026** async natif) → Component Model (en route vers 1.0, BA juin 2026) → WIT → Runtimes (Wasmtime référence) → Plugins existants.
   - **Conclusion Phase 1** : WASM possède les propriétés *mécaniques* d'une infrastructure universelle de plugins (exécution, isolation, portabilité, permissions) mais pas les propriétés *écosystémiques* (contrat sémantique, découverte, distribution) → c'est exactement le terrain du prototype.
   - Matrice de maturité 13 lignes dans le document (§7).
2. **Structure d'étude créée** façon lab HOUETOR : `AGENTS.md`, `docs-learning/{ROADMAP,LEARNING_STATE,EXPERIMENTS_LOG}.md`, `phase2_cartographie.md`.
3. **Inventaire outillage local (2026-10-04)** : Node.js présent ; `wasmtime`, `cargo`, `rustc`, `wat2wasm`, `wasm-tools`, `docker` **absents** ; aucun GPU (inutile pour cette étude — 100 % CPU/RAM).

## À faire ⏳ (ordre recommandé)

1. **Installer l'outillage Phase 3** (bloquant) : Rust via `rustup` + **wasmtime** (binaire précompilé, rapide) + `wasm-tools`.
2. **Phase 2 — remplir `phase2_cartographie.md`** : recherche ciblée par domaine (networking, cloud/edge, bases de données, desktop, serverless, embarqué, IA) + recenser les *échecs*.
3. **Phase 3 — HOUETOR Plugin Host** : scaffold, manifeste, découverte, permissions, cycle de vie (load/call/unload/update), puis mesures via script reproductible.
4. **Phase 4 — pont MCP** : exposer les fonctions du plugin en outils MCP.
5. Remplir les réponses §11 de l'étude (8 questions finales).

## Point de reprise exact

> Reprendre à **l'étape 1 ci-dessus** (installation Rust + wasmtime), puis Phase 2 fiches par domaine.
> En cas de doute : relire `AGENTS.md` §2 (ordre de lecture) et `docs-learning/EXPERIMENTS_LOG.md` (dernier : Exp 001).

## Décisions de session

- **2026-10-04** : la question « GPU en ligne ? » a été tranchée → **GPU inutile** (aucune tâche de cette étude n'est parallélisable sur GPU). Accélération = toolchain locale + recherches web parallélisées.
- **2026-10-04** : conformément au document source, le logiciel étudié en Phase 3 est **celui que nous créons** (HOUETOR Plugin Host), pas un logiciel existant.
