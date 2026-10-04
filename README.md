# houetorwasm — Architecture universelle de plugins WASM

Étude et prototypage d'une architecture universelle de plugins basée sur WebAssembly.
Sous-titre : **Interopérabilité, sécurité, portabilité et intégration avec les agents IA via MCP.**

## Structure

| Fichier | Rôle |
|---|---|
| `etude_wasm_plugins.md` | Document de référence (questions, hypothèse, méthodologie 4 phases, critères §7) |
| `phase1_etat_de_l_art.md` | Phase 1 — état de l'art WASM / WASI / Component Model / WIT / Runtimes / Plugins ✅ |
| `phase2_cartographie.md` | Phase 2 — cartographie A–H (networking, cloud, data, desktop, plugins, IA, embarqué, échecs) ✅ |
| `phase3_measures.md` | Phase 3 — mesures comparatives §8 : natif/Python/JS/WASM ✅ |
| `phase4_mcp_bridge.md` | Phase 4 — pont WASM × MCP, manifeste → outils MCP ✅ |
| `conclusion.md` | **Réponses aux 8 questions finales §11 + verdict sur l'hypothèse §9** ✅ |
| `AGENTS.md` | Mémoire d'entrée (ordre de lecture, règles, état) |
| `docs-learning/ROADMAP.md` | Avancement des 4 phases |
| `docs-learning/LEARNING_STATE.md` | État actuel + point de reprise |
| `docs-learning/EXPERIMENTS_LOG.md` | Journal des expériences (preuves brutes, Exp 001→005) |
| `prototype/` | **HOUETOR Plugin Host** : `host/host.mjs`, `plugins/`, `bench/` (comparatif §8), `mcp/` (bridge + transcript) |

## Phases

1. **État de l'art** ✅ — la WASM a-t-elle les propriétés d'un système universel de plugins ?
2. **Cartographie** ✅ — où WASM fonctionne déjà, où l'adoption est limitée (8 domaines, sources datées).
3. **Prototype** ✅ — **HOUETOR Plugin Host** : découvrir / manifeste / permissions / appeler / retirer / versionner + **comparatif §8 mesuré**.
4. **WASM × MCP** ✅ — le manifeste WASM **devient automatiquement** un jeu d'outils MCP (test 8/8).

## Conclusions en bref

- **Phase 1** : propriétés **mécaniques** ✅ (portabilité, sandbox, permissions, perf ~1,1–1,3× natif) / **écosystémiques** ❌ (contrat sémantique, découverte, distribution).
- **Phase 2** : au moins **8 contrats d'interface hétérogènes** coexistent (proxy-wasm, WIT, NaN-boxing, dlopen signé…) → *le binaire est universel, le contrat ne l'est pas* ; Docker Wasm abandonné, APISIX WASM gelé depuis 2021, adoption web réelle = 0,35 %.
- **Phase 3** : WASM sous runtime dédié = **1,5× le natif** (27,2 vs 17,8 ns), **1,3× plus rapide que le JS**, **69-152× Python**, artefact plugin **160 o**, RSS **13,7 Mo** (wasmtime) vs 41 Mo (Node) — meilleur compromis exécution/taille/isolation, pas le vainqueur brut.
- **Phase 4** : **OUI**, un plugin → outils MCP automatiquement (zéro intégration agent), avec **défense en profondeur** (bridge expose, host refuse) ; le type faible vient de l'absence de WIT, pas de MCP.
- **Hypothèse §9** : **confirmée côté technique, nuancée côté écosystème** → `conclusion.md`.
