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
5. `docs-learning/EXPERIMENTS_LOG.md` — journal des expériences (dernier : **Exp 005**)

## 3. État en bref (contrôle 2026-10-04, session 1 — fin de session)

- **Repo GitHub** : `https://github.com/bolouvipf/houetorwasm.git` (branche `main`, tout poussé).
- **Phase 1 (état de l'art) : FAITE** → `phase1_etat_de_l_art.md` (mécanique ✅ / écosystémique ❌).
- **Phase 2 (cartographie) : FAITE** → `phase2_cartographie.md` (8 domaines A–H, sources datées ; 8 contrats hétérogènes → question C confirmée).
- **Phase 3 (HOUETOR Plugin Host) : FAITE** → `prototype/host/host.mjs` + `phase3_measures.md` (Exp 003 = 8/8 étapes §4 ; Exp 004 = comparatif §8 : natif 19,2 · WASM 70,7 · JS 112,3 · Python 5 718 ns/appel).
- **Phase 4 (pont WASM × MCP) : POC FAIT** → `prototype/mcp/bridge.mjs` (test 8/8, Exp 005 ; `tools/list` généré auto depuis les manifestes).
- **Outillage local (2026-10-04)** : wasmtime **49.0.2** · Rust **1.99.0** (+ wasm32) · Node **v24.15.0** · Python **3.14** · **clang/LLVM-MinGW 22.1.8** · Docker ❌ · **aucun GPU (inutile)**.

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
# État de l'outillage (redémarrer le shell après installation si besoin)
wasmtime --version ; cargo --version ; rustc --version ; node --version

# HOUETOR Plugin Host (Phase 3)
node "prototype\host\host.mjs" list
node "prototype\host\host.mjs" info hello
node "prototype\host\host.mjs" run hello add 2 3.5
node "prototype\host\host.mjs" bench hello fibonacci 45 1000000   # <plugin> <fn> <args> <iters>
node "prototype\host\host.mjs" install "prototype\samples\needy"
node "prototype\host\host.mjs" remove needy

# Comparatif §8 (Phase 3) — 4 jambes, médiane de 5 spawns
node "prototype\bench\run_bench.mjs"          # → results.json + table markdown
# (rebuild natif si besoin : voir phase3_measures.md §6 — clang LLVM-MinGW)

# Pont MCP (Phase 4)
node "prototype\mcp\test_bridge.mjs"          # 8/8 attendus → transcript.json

# Rebuild d'un plugin (dossier du crate)
cargo build --release --target wasm32-unknown-unknown
Copy-Item "target\wasm32-unknown-unknown\release\hello.wasm" ".\hello.wasm" -Force

# Git (jamais de secrets, add ciblé)
git add -- <fichiers>; git commit -m "..."; git push
```

## 7. Obligation de fin de session

AVANT de clore : mettre à jour `docs-learning/LEARNING_STATE.md` (fait / à faire / point de reprise) + ajouter la ligne d'expérience dans `docs-learning/EXPERIMENTS_LOG.md`.
