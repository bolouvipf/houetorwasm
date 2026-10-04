# houetorwasm — Architecture universelle de plugins WASM

Étude et prototypage d'une architecture universelle de plugins basée sur WebAssembly.
Sous-titre : **Interopérabilité, sécurité, portabilité et intégration avec les agents IA via MCP.**

## Structure

| Fichier | Rôle |
|---|---|
| `etude_wasm_plugins.md` | Document de référence (questions, hypothèse, méthodologie 4 phases, critères §7) |
| `phase1_etat_de_l_art.md` | Phase 1 — état de l'art WASM / WASI / Component Model / WIT / Runtimes / Plugins ✅ |
| `phase2_cartographie.md` | Phase 2 — cartographie des systèmes utilisant WASM 🔄 |
| `AGENTS.md` | Mémoire d'entrée (ordre de lecture, règles, état) |
| `docs-learning/ROADMAP.md` | Avancement des 4 phases |
| `docs-learning/LEARNING_STATE.md` | État actuel + point de reprise |
| `docs-learning/EXPERIMENTS_LOG.md` | Journal des expériences (preuves brutes) |

## Phases

1. **État de l'art** ✅ — la WASM a-t-elle les propriétés d'un système universel de plugins ?
2. **Cartographie** 🔄 — où WASM fonctionne déjà, où l'adoption est limitée.
3. **Prototype** ⬜ — **HOUETOR Plugin Host** (découvrir / manifeste / permissions / appeler / retirer / versionner).
4. **WASM × MCP** ⬜ — un composant WASM devient-il un outil MCP pour un agent IA ?

## Conclusion Phase 1 (en bref)

WebAssembly possède les propriétés **mécaniques** d'une infrastructure universelle de plugins
(exécution portable, sandbox par défaut, permissions par capabilities, performance ~1,1–1,3× natif)
mais pas encore les propriétés **écosystémiques** : contrat d'interface sémantique, découverte,
distribution. → C'est ce manque que le prototype des Phases 3-4 cherche à explorer.
