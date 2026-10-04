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
| `docs-learning/EXPERIMENTS_LOG.md` | Journal des expériences (preuves brutes, Exp 001→013) |
| `prototype/` | **HOUETOR Plugin Host** : `host/host.mjs`, `plugins/`, `bench/` (comparatif §8), `mcp/` (bridge + transcript) |

## Phases

1. **État de l'art** ✅ — la WASM a-t-elle les propriétés d'un système universel de plugins ?
2. **Cartographie** ✅ — où WASM fonctionne déjà, où l'adoption est limitée (8 domaines, sources datées).
3. **Prototype** ✅ — **HOUETOR Plugin Host** : découvrir / manifeste / permissions / appeler / retirer / versionner + **comparatif §8 mesuré**.
4. **WASM × MCP** ✅ — le manifeste WASM **devient automatiquement** un jeu d'outils MCP (test 8/8).

## Conclusions en bref

- **Phase 1** : propriétés **mécaniques** ✅ (portabilité, sandbox, permissions, perf ~1,1–1,3× natif) / **écosystémiques** ❌ (contrat sémantique, découverte, distribution).
- **Phase 2** : au moins **8 contrats d'interface hétérogènes** coexistent (proxy-wasm, WIT, NaN-boxing, dlopen signé…) → *le binaire est universel, le contrat ne l'est pas* ; Docker Wasm abandonné, APISIX WASM gelé depuis 2021, adoption web réelle = 0,35 %.
- **Phase 3** : WASM sous runtime dédié ≈ **1,5× le natif** (médiane 5 campagnes, fourchette 0,6-1,9×), **1,4-2,2× plus rapide que le JS**, **65-238× Python**, artefact plugin **160 o**, RSS **14,4 Mo** (wasmtime) vs 40,5 Mo (Node), cycle de vie install/update/remove **14-25 ms** (Exp 008) — meilleur compromis exécution/taille/isolation, pas le vainqueur brut. - **Portabilité (Exp 007+010)** : un même binaire tournant sous **2 OS (Windows + Linux/WSL2), 4 exécuteurs, 3 moteurs** (Cranelift, Go, V8), **7 combinaisons**, même résultat. **Stabilité (Exp 009)** : absolus ×2-×3 selon l'état machine, **ratios stables** → fourchettes publiées.
- **Phase 4** : **OUI**, un plugin → outils MCP automatiquement (zéro intégration agent), avec **défense en profondeur** (bridge expose, host refuse) ; le type faible vient de l'absence de WIT, pas de MCP.
- **Capabilities WASI (Exp 011-012)** : lecture/écriture dans le dossier accordé ✅, évasion `../` refusée ✅, aucun accord = refus ✅, preopen `ro` bloque l'écriture ✅ (wazero) — **21 checks sur wasmtime/wazero/node:wasi**, `evil.txt` jamais créé.
- **Distribution (Exp 013)** : registre local (`registry`) + installation depuis **HTTP** (`install-url`) — découverte → téléchargement → validation → mise à jour versionnée, **11/11 checks**, install **224 ms** ; le standard de registre reste absent (lacune Q4 confirmée).
- **Hypothèse §9** : **confirmée côté technique, nuancée côté écosystème** → `conclusion.md`.
