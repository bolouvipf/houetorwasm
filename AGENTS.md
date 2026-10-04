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
5. `docs-learning/EXPERIMENTS_LOG.md` — journal des expériences (dernier : **Exp 015**)
6. `conclusion.md` — **réponses aux 8 questions finales §11 + verdict hypothèse §9**

## 3. État en bref (contrôle 2026-10-04, session 1 — fin de session)

- **Repo GitHub** : `https://github.com/bolouvipf/houetorwasm.git` (branche `main`, tout poussé).
- **Phase 1 (état de l'art) : FAITE** → `phase1_etat_de_l_art.md` (mécanique ✅ / écosystémique ❌).
- **Phase 2 (cartographie) : FAITE** → `phase2_cartographie.md` (8 domaines A–H, sources datées ; 8 contrats hétérogènes → question C confirmée).
- **Phase 3 (HOUETOR Plugin Host) : FAITE** → `prototype/host/host.mjs` + `phase3_measures.md` (Exp 003 = 8/8 étapes §4 ; Exp 004+006+009 = comparatif §8 **5 jambes**, campagne canonique n=9 : natif 7,2 · wasmtime 13,9 · WASM-Node 24,5 · JS 34,3 · Python 1 594 ns/appel, **fourchettes sur 5 campagnes** Exp 009 ; RSS : wasmtime 14,4 Mo vs Node 40,5 Mo ; **Exp 007+010 = portabilité : même binaire sur 2 OS (Windows+Linux/WSL2), 4 exécuteurs, 3 moteurs, même résultat** → `portability.json` + `portability_os.json` ; **Exp 008 = cycle de vie chronométré : install 18,5 / update 24,7 / remove 14,2 ms fs net** → `lifecycle.json` ; **Exp 011+012 = capabilities fichier WASI (lecture/écriture) : grant ok / évasion refusée / aucun accord refusé / ro bloqué — 21 checks sur 3 moteurs** → `wasi_caps.json` + `wasi_write.json` ; **Exp 013 = distribution : registre local + install-url HTTP (découverte → téléchargement → validation → mise à jour versionnée) — 11/11 checks, install 224 ms** → `registry_test.json` ; **Exp 014 = intégrité : épinglage sha256 (obligatoire à distance, vérifié à chaque chargement + avant copie), altération détectée — 15/15 checks**).
- **Phase 4 (pont WASM × MCP) : POC FAIT** → `prototype/mcp/bridge.mjs` (test 8/8, Exp 005 ; `tools/list` généré auto depuis les manifestes ; **Exp 015 = filtrage policy allow/deny via `HOUETOR_MCP_POLICY`, fail-closed, 9/9** → `policy_test.json`).
- **Conclusion §11 : ÉCRITE** → `conclusion.md` (hypothèse §9 confirmée côté technique, nuancée côté écosystème).
- **Outillage local (2026-10-04)** : wasmtime **49.0.2** (Windows + Linux/WSL2) · **wazero 1.12** (Exp 007/010, `%TEMP%\opencode\wazero\` + `~/tools` WSL) · **WSL2 Ubuntu 26.04** (8 cœurs) · Rust **1.99.0** (+ wasm32) · Node **v24.15.0** · Python **3.14** · **clang/LLVM-MinGW 22.1.8** · Docker ❌ · Wasmer 7.5 = non fonctionnel ici · **aucun GPU (inutile)** · **attention : shells persistants n'ont pas les PATH récents → chemins absolus (`%USERPROFILE%\.cargo\bin`, `~\.local\bin\wasmtime-*`)**.

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
node "prototype\host\host.mjs" registry <dossier-registre>       # Exp 013 : découverte <reg>/<nom>/<version>/manifest.json
node "prototype\host\host.mjs" install-url <baseURL>             # Exp 013 : install depuis HTTP (ex. http://127.0.0.1:PORT/reg/1.0.0/)
node "prototype\host\host.mjs" hash "prototype\plugins\hello"    # Exp 014 : empreinte sha256 du wasm (rédaction manifeste)

# Comparatif §8 (Phase 3) — 5 jambes ; campagne canonique : BENCH_RUNS=9 (Exp 009)
$env:BENCH_RUNS="9"; node "prototype\bench\run_bench.mjs"   # → results.json + table markdown
# (jambe native : voir phase3_measures.md §7 — clang LLVM-MinGW ;
#  jambe wasmtime : cargo build --release --target wasm32-wasip2 (fib_wasi))
powershell -NoProfile -ExecutionPolicy Bypass -File "prototype\bench\peak_rss.ps1"  # RSS pic → peak_rss.json
node "prototype\bench\portability.mjs"        # Exp 007 : même binaire, 4 exécuteurs → portability.json
powershell -NoProfile -ExecutionPolicy Bypass -File "prototype\bench\portability_os.ps1"  # Exp 010 : multi-OS (WSL2) → portability_os.json
node "prototype\bench\lifecycle.mjs"          # Exp 008 : install/update/remove chronométrés → lifecycle.json
node "prototype\bench\wasi_caps.mjs"          # Exp 011 : lecture sandboxée (9/9) → wasi_caps.json
node "prototype\bench\wasi_write.mjs"         # Exp 012 : écriture + ro (21 checks) → wasi_write.json
node "prototype\bench\registry_test.mjs"      # Exp 013+014 : registre + install-url + sha256 (15/15) → registry_test.json

# Pont MCP (Phase 4)
node "prototype\mcp\test_bridge.mjs"          # 8/8 attendus → transcript.json
node "prototype\mcp\policy_test.mjs"          # Exp 015 : filtrage policy (9/9) → policy_test.json

# Rebuild d'un plugin (dossier du crate)
cargo build --release --target wasm32-unknown-unknown
Copy-Item "target\wasm32-unknown-unknown\release\hello.wasm" ".\hello.wasm" -Force

# Git (jamais de secrets, add ciblé)
git add -- <fichiers>; git commit -m "..."; git push
```

## 7. Obligation de fin de session

AVANT de clore : mettre à jour `docs-learning/LEARNING_STATE.md` (fait / à faire / point de reprise) + ajouter la ligne d'expérience dans `docs-learning/EXPERIMENTS_LOG.md`.
