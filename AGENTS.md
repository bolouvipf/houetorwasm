# AGENTS.md — Mémoire d'entrée du dossier d'étude WASM WASI (auto-chargé au démarrage)

> Lu automatiquement par opencode au début de session dans ce dossier.
> Règles d'or : (1) respecter l'ordre de lecture, (2) mettre à jour `docs-learning/LEARNING_STATE.md` AVANT de finir toute session, (3) preuve brute avant toute conclusion.

## 1. Ce qu'est ce dossier

Étude et prototypage d'une **architecture universelle de plugins basée sur WebAssembly**.
Deux moitiés :

- **Recherche** (Phases 1-2) : état de l'art + cartographie de l'existant.
- **Construction** (Phases 3-4) : on **fabrique nous-mêmes** le logiciel sujet d'expérimentation — le **HOUETOR Plugin Host** (« Universal WASM Plugin Host ») — puis on lui ajoute un pont MCP.

On n'étudie PAS un logiciel existant choisi au hasard : on crée le nôtre et on le mesure.

## 2. Lecture obligatoire au démarrage (dans l'ordre)

1. `etude_wasm_plugins.md` — document de référence (questions, hypothèse, méthodologie 4 phases, critères §7)
2. `phase1_etat_de_l_art.md` — **fait** (2026-10-04)
3. `docs-learning/ROADMAP.md` — avancement des 4 phases
4. `docs-learning/LEARNING_STATE.md` — **état actuel + point de reprise**
5. `docs-learning/EXPERIMENTS_LOG.md` — journal des expériences (dernier : **Exp 001**)

## 3. État en bref (contrôle 2026-10-04)

- **Phase 1 (état de l'art) : FAITE** → `phase1_etat_de_l_art.md` (conclusion : propriétés mécaniques ✅ / propriétés écosystémiques ❌).
- **Phase 2 (cartographie) : EN COURS** → `phase2_cartographie.md` (squelette prêt, à remplir).
- **Phase 3 (prototype HOUETOR Plugin Host) : pas commencée.**
- **Phase 4 (pont WASM × MCP) : pas commencée.**
- **Outillage local : QUASI ABSENT** (contrôle 2026-10-04) — Node.js ✅ ; `wasmtime`, `cargo`, `rustc`, `wat2wasm`, `wasm-tools`, `docker` **ABSENTS** ; **aucun GPU local** (normal : inutile ici).
- **Pas encore de repo git** dans ce dossier.

## 4. Réponse rapide à la question « GPU en ligne ? »

**Un GPU ne sert à rien dans cette étude.** Tout le travail est CPU/RAM : compilation Rust → wasm, chargement/invocation de plugins par wasmtime, mesures de temps. Un GPU (Colab/Kaggle/Vast.ai) n'accélère rien ici. Ce qui accélère vraiment : installer **Rust + wasmtime** en local (10 min) et lancer les mesures.

## 5. Règles absolues (résumé)

1. **Preuve brute avant conclusion** (sortie de commande, chiffre, URL + date de source).
2. Toujours **dater et sourcer** les affirmations de maturité/versions (l'écosystème WASM change vite).
3. Aucun secret, token ou clé dans ces fichiers.
4. Fichiers d'étude en **français** ; code/CLI en anglais.
5. `LEARNING_STATE.md` mis à jour avant fin de session ; expériences tracées dans `EXPERIMENTS_LOG.md` (format Exp 00N).
6. Phase 3 : toute mesure du prototype passe par un script reproductible (pas de chiffre « à la main »).

## 6. Commandes de base

```powershell
# État de l'outillage
wasmtime --version ; cargo --version ; rustc --version

# (À compléter dès l'installation : build plugin, run plugin, bench)
```

## 7. Obligation de fin de session

AVANT de clore : mettre à jour `docs-learning/LEARNING_STATE.md` (fait / à faire / point de reprise) + ajouter la ligne d'expérience dans `docs-learning/EXPERIMENTS_LOG.md`.
