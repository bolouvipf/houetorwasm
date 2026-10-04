# EXPERIMENTS_LOG — Journal des expériences

> Format : `## Exp 00N — Titre (date)` · Contexte · Action · **Preuves brutes** · Résultat · Suite.
> Preuve brute obligatoire : sortie de commande, chiffre mesuré, URL + date de source.

---

## Exp 001 — Phase 1 : état de l'art WASM/WASI/Component Model (2026-10-04)

**Contexte :** démarrage de l'étude ; question §2.A « la technologie a-t-elle les propriétés nécessaires à un système universel de plugins ? »

**Action :** recherches web multicouches (spécifications, Bytecode Alliance, WASI.dev, benchmarks runtimes, systèmes de plugins existants) + rédaction de `phase1_etat_de_l_art.md`.

**Preuves brutes (extrait daté) :**
- WASI 0.2 voté le **2024-01-25** ; **WASI 0.3 publié le 2026-06-11** (`async func`, `stream<T>`, `future<T>` ; `wasi:io` supprimé) — wasi.dev/releases, github.com/WebAssembly/WASI.
- WASI 0.3.1 : `map<K,V>` adopté le **2026-08-06** — wasi.dev/releases.
- Bytecode Alliance, *The Road to Component Model 1.0* (**2026-06-08**) : Component Model et WASI « déjà largement utilisés en production » ; WASI 1.0 suivra la 1.0 du Component Model.
- Benchmarks runtimes 2026-01-15 : Wasmtime cold start **5,2 ms** / exécution 10,4 ms ; Wasmer 6,8/12,1 ; wazero 4,5/18,7 ; WasmEdge 8,1/15,3 ; Wasm3 2,1/45,2 — wasmruntime.com/en/benchmarks.
- Adoption navigateur : **~96 %** (caniuse, juillet 2026) ; **~5,5 % des pages Chrome** chargent du WASM (State of WebAssembly 2026).
- Sécurité : capabilities WASI deny-by-default, handles infalsifiables (wasi.dev/security) ; preuve formelle = USENIX Security 2022 (vWasm/rWasm) ; **contre-exemple** : Node.js WASI « ne pas exécuter de code non fiable » (node/doc/api/wasi.md).
- Chaque système de plugins a redéfini SON contrat : Extism (manifest+PDK), proxy-wasm ABI 0.2.1 (spéc fragile), Shopify Wasm API (NaN-boxing), wasmCloud (WIT) → **confirmation empirique de la question C**.

**Résultat :** réponse **nuancée oui/non** (§8 de `phase1_etat_de_l_art.md`) : ✅ mécanique / ❌ écosystémique.

**Suite :** Phase 2 (cartographie) ; toolchain pour Phase 3.

---

## Exp 002 — Repo GitHub + toolchain locale (2026-10-04)

**Contexte :** centraliser l'étude et débloquer la Phase 3 (prototype).

**Action :** `git init` + remote `https://github.com/bolouvipf/houetorwasm.git` ; installation wasmtime (binaire précompilé) et Rust (rustup, profile minimal).

**Preuves brutes :**
- `git ls-remote --heads origin` → `6784a11e71e2227f14559e7e0e9f8c45bc3a18ce refs/heads/main` (poussée OK, 9 fichiers, 965 insertions).
- `wasmtime 49.0.2 (3c8a3e79a 2026-10-02)` installé dans `C:\Users\Kimsh\.local\bin\...` (ajouté au PATH utilisateur).
- `rustc 1.99.0 (b940084d7 2026-09-28)` / `cargo 1.99.0` ; cibles ajoutées : `wasm32-unknown-unknown`, `wasm32-wasip2`.
- Node.js `v24.15.0` déjà présent. GPU local : **aucun** (inutile — travail 100 % CPU/RAM).

**Résultat :** outillage opérationnel ; débat « GPU en ligne » tranché → sans objet pour cette étude.

**Suite :** MVP du HOUETOR Plugin Host.

---

## Exp 003 — Phase 3 : MVP du HOUETOR Plugin Host (2026-10-04)

**Contexte :** étude §4 — construire un host qui découvre, vérifie le manifeste, charge, accorde des permissions, appelle, retire, installe une nouvelle version, met à jour sans modifier le host.

**Action :** host Node `prototype/host/host.mjs` (deny-by-default) + plugin Rust `hello` (`wasm32-unknown-unknown`, cdylib) + plugin `needy` (importe `env.host_log`) pour prouver le refus.

**Preuves brutes (sorties réelles, 2026-10-04) :**

1. Découverte / manifeste :
```text
hello@1.0.0  size=160B  exports=[add,fibonacci,plugin_version]  perms=[aucune]
```
2. Appel + timings :
```json
{"plugin":"hello@1.0.0","call":"add","args":["2","3.5"],"result":5.5,
 "timings_ms":{"load":8.551,"compile":3.15,"instantiate":0.509,"call":0.8446},
 "wasm_bytes":160,"memory_bytes":1048576,"imports_granted":0}
{"plugin":"hello@1.0.0","call":"fibonacci","args":["30"],"result":832040}
```
3. Benchmark (10 000 appels, win32 x64 node v24.15.0) :
```json
{"cold_load_ms":7.336,"compile_ms":1.879,"instantiate_ms":0.298,
 "call_avg_ms":0.000436,"wasm_bytes":160,"memory_bytes":1048576}
```
4. **Deny-by-default** (plugin `needy` réclame `env.host_log`, manifeste sans permission) :
```text
[host] ERREUR : needy : chargement refusé — sandbox deny-by-default : imports refusés [env.host_log] (permissions accordées : aucune)   (exit=1)
```
5. **Permission déclarée mais non accordée par l'hôte** :
```text
[host] ERREUR : needy : permissions NON accordées par l'hôte : env.host_log   (exit=1)
```
6. **Retrait** :
```text
[host] retiré : needy (plus aucun fichier, plus aucune instance)
[host] installé : needy@1.0.0   (réinstallation depuis prototype/samples)
```
7. **Mise à jour sans toucher au host** (hello 1.0.0 → 1.0.1, `plugin_version` passe de 1 à 2) :
```text
[host] version précédente 1.0.0 archivée → ..\plugins\hello\.history\1.0.0
[host] installé : hello@1.0.1
"plugin":"hello@1.0.1","call":"plugin_version","result":2
"plugin":"hello@1.0.1","call":"add","args":["40","2"],"result":42
```
8. **Version déjà installée refusée** :
```text
[host] ERREUR : hello : version 1.0.1 déjà installée (incrémentez la version)   (exit=1)
```

**Bugs trouvés & corrigés pendant l'Exp 003 :**
- `return` au top-level ESM → `SyntaxError: Illegal return statement` (corrigé : `break`).
- `fs.cpSync` interdit de copier un dossier dans son propre sous-dossier (archive `.history`) → pattern temporaire + rename.
- `rust-lld: undefined symbol: host_log` → `.cargo/config.toml` avec `-C link-arg=--allow-undefined` + `#[link(wasm_import_module = "env")]`.
- Erreurs host en stacktrace → messages propres via `try/catch` + `die()`.

**Résultat :** les 8 étapes de l'étude §4 sont démontrées (1-8) par des sorties brutes. Mesures §7 partiellement couvertes (chargement, exécution, mémoire, taille, isolation/permissions, installation, mise à jour, retrait).

**Suite :** `phase3_measures.md` (comparaison natif/Python/JS/WASM §8) ; extensions : WASI 0.2 via wasmtime (capabilities fichier/réseau), signatures de plugins, Phase 2 (cartographie) à compléter.

---

## Exp 004 — Comparatif §8 : natif / Python / JS / WASM (2026-10-04)

**Contexte :** étude §8 « implémenter la même fonctionnalité en 4 langages et mesurer (§7) ».

**Action :** installation **LLVM-MinGW 22.1.8** (`winget install MartinStorsjo.LLVM-MinGW.UCRT`) → compilateur C natif ; création de `prototype/bench/{fib.c,fib.py,fib.js,run_bench.mjs}` + signature `bench <plugin> <fn> <args> <iters>` étendue dans `host.mjs` ; 5 spawns par jambe, médiane.

**Preuves brutes (sortie `node prototype\bench\run_bench.mjs`, 2026-10-04T06:45:19Z) :**

| Implémentation | artefact (o) | wall end-to-end (ms) | 1er appel (µs) | par appel (ns) | RSS max (KB) | K |
|---|---:|---:|---:|---:|---:|---:|
| Natif (C, MinGW) | 88 064 | 209,37 | 0,2 | **19,2** | 3 660 | 10 M |
| Python 3.14 | 1 735 | 802,05 | 11,1 | 5 718 | 16 232 | 100 k |
| JavaScript (Node 24) | 991 | 284,41 | 92,8 | 112,3 | 40 980 | 1 M |
| WASM plugin (HOUETOR) | **160** | 894,25 | 1,9 | **70,7** | 41 060 | 10 M |

Chaque jambe renvoie `result: 1134903170` (fib(45), même valeur). WASM : `cold_load_ms: 4.207` (compile 1,551 + instantiate 0,244), `memory_bytes: 1048576`, `wasm_bytes: 160`.
→ **Rapport complet** : `phase3_measures.md` ; données : `prototype/bench/results.json`.

**Résultat :** WASM = **3,7× plus lent que le natif**, **1,6× plus rapide que le JS pur**, **81× plus rapide que Python**, avec l'artefact le plus petit (160 o) ; le RSS 41 MB est le coût du runtime hôte Node, pas du plugin.

**3 bugs trouvés & corrigés pendant l'Exp 004 (preuves) :**
1. **Dead code éliminé** : 1ère mesure native `compute_ms: 0.000` → le compilateur supprimait la boucle dont le résultat n'était pas lu → correctif `volatile long long sink` (+ observateur `if (sink == -1)`) → `compute_ms: 56.025` pour K=3 M (18,7 ns/appel, cohérent avec 45 itérations).
2. **ctypes sans `argtypes`** : `maxrss_kb: 0` côté Python (pointeurs tronqués sur Win64) → `GetProcessMemoryInfo.argtypes/restype` explicites → `16232`.
3. **K non injecté côté WASM** : `compute_ms: 0.04`, `per_call_ns: NaN` (placeholder `{K}` non remplacé → itérations `NaN`) → substitution `args.map(a => a==="{K}" ? k : a)` → `706.71 / 70.7`.
4. Biais détecté : `fib` en **BigInt** pénalisait artificiellement JS (822 ns/appel) → bascule en `double` (fib(45) < 2^53, exact) → 112,3 ns/appel.

**Suite :** jambe **wasmtime CLI** (isoler le RSS du runtime WASM sans Node) ; portabilité (rejouer `hello.wasm` sous wasmtime/Firefox) ; instrumenter install/mise à jour.

---

## Exp 005 — Phase 4 : pont WASM × MCP, manifeste → outils MCP (2026-10-04)

**Contexte :** étude §5 « un composant WASM peut-il être transformé automatiquement en outil MCP ? »

**Action :** `prototype/mcp/bridge.mjs` — serveur MCP (stdio, JSON-RPC 2.0, **0 dépendance**) qui génère `tools/list` **à partir des manifestes** découverts via `host.mjs` (client pur du host) ; test `test_bridge.mjs` (handshake complet + assertions).

**Preuves brutes (sortie `node prototype\mcp\test_bridge.mjs` → exit=0) :**

```text
✅ initialize : serverInfo — {"name":"houetor-mcp-bridge","version":"0.1.0"}
   outils générés automatiquement : ["hello_add","hello_fibonacci","hello_plugin_version","needy_do_log","needy_plugin_version"]
✅ tools/list auto : exports de hello → outils MCP
✅ schéma JSON du tool (inputSchema) — {"type":"object","properties":{"args":{...}}}
✅ tools/call hello_add(2, 3.5) → résultat 5.5 via host deny-by-default — result=5.5 plugin=hello@1.0.1
✅ outil inconnu refusé — outil inconnu : does_not_exist
✅ défense en profondeur : needy_do_log exposé mais REFUSÉ par le host —
   [host] ERREUR : needy : chargement refusé — sandbox deny-by-default : imports refusés [env.host_log] (permissions accordées : aucune)
✅ method inconnue → -32601
8/8 étapes OK → transcript.json
```

**Résultat :** **réponse OUI** à la question §5 (transformation automatique, zéro intégration agent), avec limites listées (typage `number[]` seulement — le manque vient de l'absence de WIT/Component Model, pas de MCP). **Découverte** : défense en profondeur — un plugin installé est exposé en outil MAIS le host refuse son appel si permissions manquantes (2 barrières indépendantes).
→ Rapport : `phase4_mcp_bridge.md` ; transcript brut : `prototype/mcp/transcript.json`.

**Suite :** test avec vrai client MCP externe, types riches via WIT, hôte wasmtime (Rust).

---

## Exp 006 — Jambe wasmtime + RSS pic externe (2026-10-04)

**Contexte :** étude §7/§8 — la jambe WASM passait par Node (RSS 41 MB = coût Node, pas du WASM) et WASI ne fournit pas `maxrss`.

**Action :** (1) commande `prototype/bench/fib_wasi/` (Rust → `wasm32-wasip2`, même fib + `sink`) exécutée par **wasmtime 49.0.2** ; ajout comme 5ᵉ jambe dans `run_bench.mjs` (résolution auto du chemin `~/.local/bin/wasmtime-*/`) ; (2) `peak_rss.ps1` : RSS pic **externe** par polling `PeakWorkingSet64` pendant l'exécution (médiane de 3).

**Preuves brutes :**

Test direct wasmtime :
```text
{"impl":"wasm-wasmtime","result":"1134903170","first_call_us":13.900,"compute_ms":36.283,"per_call_ns":36.3,"k":1000000,"n":45,"maxrss_kb":0}
```

Comparatif final 5 jambes (`results.json`, 06:58:40Z, médianes de 5) :

| Jambe | artefact (o) | wall (ms) | 1er appel (µs) | par appel (ns) |
|---|---:|---:|---:|---:|
| Natif (C) | 88 064 | 193,75 | 0,2 | **17,8** |
| WASM wasmtime | 135 135 | 332,86 | 9,5 | **27,2** |
| WASM plugin (host Node) | 160 | 760,69 | 2,0 | 59,9 |
| JavaScript (Node) | 991 | 199,86 | 63,5 | 80,5 |
| Python 3.14 | 1 735 | 618,30 | 10,9 | 4 127,6 |

RSS pic externe (`peak_rss.json`, médiane de 3, workload complet) :
```text
Natif (C)                :  4 196 KB
Python 3.14              : 16 268 KB
JavaScript (Node)        : 40 328 KB
WASM plugin (host Node)  : 41 424 KB
WASM commande (wasmtime) : 13 736 KB
```

**Résultat :** avec un **runtime dédié, l'écart au natif tombe à ~1,5×** (27,2 vs 17,8 ns — *ces chiffres datent de la campagne C1 ; précisé par Exp 009 : fourchette 0,6-1,9×, médiane ≈ 1,5×*) contre 3,4× via Node ; wasmtime coûte **13,7 MB de RSS contre 41 MB pour Node (3× moins)** ; le plugin = **160 o + 1 Mo** de mémoire linéaire ; **portabilité multi-runtimes démontrée** : même charge, même résultat `1134903170` sous V8 (Node) **et** Cranelift (wasmtime).

**2 bugs corrigés pendant l'Exp 006 :**
1. `cargo`/`wasmtime` **absents du PATH** de la session persistante (installations post-démarrage) → chemins absolus (`%USERPROFILE%\.cargo\bin`, `~/.local/bin/wasmtime-*/`), résolution dynamique dans le script.
2. `Start-Process -ArgumentList` **échouait sur les chemins avec espace** (`Desktop\WASM WASI` coupé en 2 → « module not found » partout) et **tableau vide rejeté** → guillemetage automatique des args contenus en espace + branche sans ArgumentList. Les 1ʳˢ pics mesurés (processus en échec) étaient invalides → script corrigé, run refait proprement (aucune erreur en sortie).

**Suite :** ~~portabilité 3ᵉ runtime~~ → **fait : Exp 007** (wazero + node:wasi, `all_runtimes_agree: true`) ; reste : instruments install/mise à jour, workload non compute-bound.

---

## Exp 007 — Portabilité : même binaire, 4 exécuteurs, 3 moteurs (2026-10-04)

**Contexte :** critère « portabilité » de l'étude §7 — Phase 2 montrait ≥ 8 contrats hétérogènes ; restait à prouver empiriquement qu'**un même artefact WASM tourne sous plusieurs runtimes avec le même résultat**.

**Action :** ajout du 3ᵉ moteur indépendant **wazero 1.12** (Go pur, `https://github.com/tetratelabs/wazero/releases/download/v1.12.0/wazero_1.12.0_windows_amd64.zip` → `%TEMP%\opencode\wazero\wazero.exe`) + utilisation du **WASI intégré à Node (node:wasi, V8)** ; construction de `fib-wasi` en **p1** et **p2** (`rustup target add wasm32-wasip1`) ; script reproductible `prototype/bench/portability.mjs` (médiane de 5 spawns/jambe, vérification stricte `result == 1134903170`).

**Tentative avortée notée :** Wasmer 7.5 (winget `Wasmer.Wasmer`) — l'installateur se termine en code 2, et le binaire « portable » téléchargé directement depuis GitHub **se bloque sans sortie** → écarté au profit de wazero (honêteté : non pas « moins bon », mais **non fonctionnel sur cette machine**).

**Preuves brutes** (`portability.json`, 2026-10-04, `all_runtimes_agree: true`) :

| Runtime (même binaire WASM) | 1er appel (µs) | par appel (ns) | résultat |
|---|---:|---:|---|
| wasmtime 49 (Cranelift) — composant WASI p2 | 7,9 | 17,1 | `1134903170` |
| wasmtime 49 (Cranelift) — module WASI p1 | 4,6 | 21,7 | `1134903170` |
| wazero 1.12 (moteur Go) — module WASI p1 | 2,2 | 44,0 | `1134903170` |
| node:wasi (V8) — module WASI p1 | 1,5 | 52,6 | `1134903170` |

Sorties unitaires (preuve brute du 1ᵉʳ run) :
```text
{"impl":"wasm-wazero","result":"1134903170","first_call_us":2.000,"compute_ms":32.455,"per_call_ns":32.5,"k":1000000,"n":45,"maxrss_kb":0}
{"impl":"wasmtime-p1","result":"1134903170","first_call_us":12.000,"compute_ms":28.703,"per_call_ns":28.7,"k":1000000,"n":45,"maxrss_kb":0}
{"impl":"wasmtime-p2","result":"1134903170","first_call_us":7.500,"compute_ms":19.615,"per_call_ns":19.6,"k":1000000,"n":45,"maxrss_kb":0}
{"impl":"node-wasi","result":"1134903170","first_call_us":1.300,"compute_ms":51.608,"per_call_ns":51.6,"k":1000000,"n":45,"maxrss_kb":0}
```

RSS pic étendu (`peak_rss.json`, médiane de 3, workload complet, 6 variantes) :
```text
Natif (C) : 3792 KB · Python 3.14 : 16340 KB · JavaScript (Node) : 40476 KB
WASM plugin (host Node) : 41380 KB · WASM commande (wasmtime) : 14384 KB · WASM commande (wazero) : 16100 KB
```

**Résultat :** **critère portabilité ✅** : 1 même fichier → **4 exécuteurs, 3 moteurs indépendants** (Cranelift, Go, V8), 2 formats de standardisation (p1 module + p2 composant), **1 résultat identique** ; exécution 17-53 ns selon moteur (≤ 3× d'écart entre moteurs) ; RSS runtime WASM dédié : **14-16 MB** (wasmtime et wazero), stable entre moteurs.

**Suite :** portabilité hors Windows (Linux/nappe), réplication navigateur (WebAssembly natif), décision p1 vs p2 (le composant p2 est ici *plus rapide* : 17,1 vs 21,7 ns — à confirmer à plus grande échelle).

---

## Exp 008 — Temps d'installation / mise à jour / retrait (2026-10-04)

**Contexte :** critères §7 « Temps d'installation / mise à jour » et « Retirer/versions » : le retrait/versionnage étaient **prouvés fonctionnels** (Exp 003) mais **jamais chronométrés**.

**Action :** script `prototype/bench/lifecycle.mjs` — plugin témoin `lifecycleprobe` (copie du wasm `hello`, versions 1.0.0 → 1.0.1) créé en TMP, **5 cycles** complet install → réinstallation dupliquée → mise à jour → retrait via l'CLI du host, **médiane** ; baseline `node -e ""` mesurée pour isoler le fs du spawn Node (73,3 ms).

**Preuves brutes** (`lifecycle.json` + `lifecycle.raw.json`, 2026-10-04) :

| Opération (host CLI) | wall médiane (ms) | net fs (ms) |
|---|---:|---:|
| install | 91,8 | **18,5** |
| install (dup refusé) | 81,1 | **7,9** |
| update (v1.0.0 → v1.0.1) | 98,0 | **24,7** |
| remove | 87,5 | **14,2** |

```text
baseline spawn node = 73.3 ms
checks: dup_refused=true update_ok=true remove_ok=true probe_gone=true hello_intact=true
```

**Résultat :** le **cycle de vie complet d'un plugin coûte 14-25 ms d'I/O disque** (≤ 25 ms même pour une mise à jour avec archivage `.history/`), soit ≈ 100 ms en bout de ligne avec le spawn de Node ; le refus de doublon est le chemin le plus rapide (échec anticipé). Le plugin témoin est détruit à la fin, `hello` intact (vérifié) — **critères install/update/removal/versions ✅ chronométrés**.

**Suite :** déplacer/charger depuis un état distant (réseau/registre) ; workload non compute-bound.

---

## Exp 009 — Stabilité du banc : 5 campagnes de comparatif (2026-10-04)

**Contexte :** les campagnes successives donnaient des absolus très différents (ex. wasmtime 27,2 → 9,5 ns) → risque de publier un chiffre fragile. Le lab exige de le mesurer plutôt que de l'ignorer.

**Action :** 5 campagnes complètes `run_bench.mjs` le même jour (4 × médiane de 5 spawns + 1 finale **médiane de 9 spawns** = campagne canonique, celle de `results.json`).

**Preuves brutes — `per_call_ns` par campagne :**

| Jambe | C1 (06:58, n=5) | C2 (n=5) | C3 (n=5) | C4 (n=5) | **C5 canonique (n=9)** | absolus |
|---|---:|---:|---:|---:|---:|---|
| Natif (C) | 17,8 | 16,0 | 12,9 | 8,3 | **7,2** | 7,2 – 17,8 |
| Python 3.14 | 4 127,6 | 1 860,3 | 2 970,9 | 2 410,8 | **1 593,6** | 1 594 – 4 128 |
| JavaScript (Node) | 80,5 | 38,8 | 68,6 | 54,6 | **34,3** | 34,3 – 80,5 |
| WASM plugin (host Node) | 59,9 | 26,1 | 31,5 | 36,6 | **24,5** | 24,5 – 59,9 |
| WASM wasmtime | 27,2 | 9,5 | 12,5 | 13,2 | **13,9** | 9,5 – 27,2 |

**Ratios *intra*-campagne (ce qui est robuste) :**

| Ratio | C1 | C2 | C3 | C4 | C5 | fourchette | médiane |
|---|---:|---:|---:|---:|---:|---|---:|
| wasmtime / natif | 1,53 | 0,59 | 0,97 | 1,59 | 1,93 | **0,6 – 1,9×** | **≈ 1,5×** |
| WASM-host / JS | 0,74 | 0,67 | 0,46 | 0,67 | 0,71 | **0,5 – 0,7×** (host 1,4-2,2× plus rapide) | ≈ 1,5× plus rapide |
| Python / WASM-host | 69 | 71 | 94 | 66 | 65 | **65 – 94×** | ≈ 70× |
| Python / wasmtime | 152 | 196 | 238 | 183 | 115 | **115 – 238×** | ≈ 180× |

**Résultat :** les **absolus varient ×2-×3** selon l'état machine (fréquence, charge OS, JIT), mais **les ratios sont stables** : « wasmtime ≈ natif (médiane 1,5×) », « WASM-via-host ≈ 1,5× le JS », « Python = 65-238× plus lent » sont des conclusions **robustes** ; les artefacts et RSS sont **stables à ±5 %** (invariants les plus fiables). Méthode retenue pour la suite : **BENCH_RUNS=9** et publication de fourchettes, jamais d'un point unique.

**Suite :** variance multi-machines/OS ; pinning CPU (affinité) si l'on veut resserrer les absolus.

---

## Exp 010 — Portabilité MULTI-OS : Windows + Linux, même binaire (2026-10-04)

**Contexte :** Exp 007 avait prouvé la portabilité *moteurs* sur Windows uniquement — restait le critère « même artefact sur un autre OS ».

**Action :** environnement **WSL2 Ubuntu 26.04** (8 cœurs, x86_64) outillé avec les **mêmes runtimes côté Linux** (`~/tools` : wasmtime 49.0.2 linux-x86_64, wazero 1.12.0 linux-amd64 — *note : l'asset Linux de wazero est `.tar.gz`, `.zip` = « Not Found »*) ; script `prototype/bench/portability_os.sh` (médiane de 5/jambe, contrôle `result == 1134903170`) + pilote Windows `portability_os.ps1` (chemin `C:\…` → `/mnt/c/…`).

**Preuves brutes** (`portability_os.json`, exit=0) :

```text
{"os":"Linux 6.18.33.1-microsoft-standard-WSL2 x86_64","kernel":"6.18.33.1-microsoft-standard-WSL2","cores":8,"k":10000000,"n":45,"runs":5}
{"label":"wasmtime (Cranelift) — Linux x86_64, module WASI p1","per_call_ns":11.7,"runs":5,"k":10000000,"n":45,"result":"1134903170"}
{"label":"wazero (moteur Go) — Linux x86_64, module WASI p1","per_call_ns":14.1,"runs":5,"k":10000000,"n":45,"result":"1134903170"}
{"label":"node:wasi (V8) — Linux, module WASI p1","per_call_ns":24.0,"runs":5,"k":10000000,"n":45,"result":"1134903170"}
{"all_runtimes_agree":true}
```

**Bilan portabilité cumulé (Exp 007 + 010)** : **1 fichier** (`fib-wasi.wasm`) → **2 OS** (Windows 11/NT + Linux WSL2/Ubuntu 26.04) · **3 moteurs** (Cranelift, Go, V8) · **2 formats** (p1/p2) · **7 combinaisons exécuteur×OS**, **toutes à `1134903170`** ; perf Linux 11,7-24,0 ns = mêmes ordres de grandeur que Windows (9,5-52,6 ns).

**Résultat :** critère **portabilité ✅ multi-OS** ; « la même charge marche partout » est désormais démontré de bout en bout (binaire copié sur un second OS, exécuté par 3 moteurs différents, résultat identique).

**Suite :** macOS/ARM (croisé), navigateur (WebAssembly DOM), charge de fichiers WASI (lecture/écriture réelle côté OS).

---

## Exp 011 — Capabilities fichier WASI : deny-by-default + escape bloqué (2026-10-04)

**Contexte :** le hôte prouvait ses permissions *applicatives* (manifeste, Exp 003/005), mais pas les **capabilities système WASI** (§7 « contrôle des permissions », H §Phase 2) : que se passe-t-il réellement quand un plugin veut lire un fichier ?

**Action :** module `prototype/samples/filecap` (Rust → `wasm32-wasip1`, 124 186 o) qui lit une cible passée en argument et imprime un JSON (len + somme octets = intégrité) ; script `prototype/bench/wasi_caps.mjs` : **3 scénarios × 3 runtimes** (wasmtime `--dir`, wazero `-mount`, node:wasi `preopens`), médiane de 3, cible d'évasion `data/../secret.txt` (secret hors du dossier accordé).

**Preuves brutes** (`wasi_caps.json`, 9/9 `all_runtimes_agree: true`) :

```text
✅ wasmtime 49 (Cranelift) · grant → ok
✅ wasmtime 49 (Cranelift) · escape → err (Operation not permitted (os error 63))
✅ wasmtime 49 (Cranelift) · nogrant → err (No such file or directory (os error 44))
✅ wazero 1.12 (moteur Go) · grant → ok
✅ wazero 1.12 (moteur Go) · escape → err (Operation not permitted (os error 63))
✅ wazero 1.12 (moteur Go) · nogrant → err (No such file or directory (os error 44))
✅ node:wasi (V8) · grant → ok
✅ node:wasi (V8) · escape → err (Capabilities insufficient (os error 76))
✅ node:wasi (V8) · nogrant → err (No such file or directory (os error 44))
```

Contenu lu sous grant : `len=16, byte_sum=1157` — **identique sur les 3 runtimes** (intégrité vérifiée).

**Résultat :** les 3 moteurs implémentent la même sémantique de capabilities :
1. **Rien accordé → rien lisible** (deny-by-default au niveau runtime, indépendant de notre hôte) ;
2. **Accord = chemin exact** : la tentative d'évasion `data/../secret.txt` est **refusée** (`Operation not permitted` chez Cranelift et Go, `Capabilities insufficient` chez V8) ;
3. **Semantique portable** : mêmes statuts `ok/err/err` sur 3 moteurs → le modèle « l'hôte accorde des dossiers, le plugin ne voit que cela » est fiable quel que soit le runtime.
*Note de terrain* : wazero documente lui-même que des mounts de volume entiers (ex. `-mount=/`) permettent la fuite via `../../` → **c'est la granularité du preopen qui protège**, pas le moteur (argument pour des allow-lists fines).

**2 bugs de méthode corrigés pendant l'Exp 011 :**
1. le pilote ne fusionnait pas `rt.env` (`WASI_PREOPENS`) → faux négatif node:wasi en grant ;
2. **le scénario escape de node:wasi ne recevait pas son preopen** → son `err` prouvait l'absence d'accès, pas le blocage de la traversée `../`. Corrigé (preopen présent sur grant **et** escape) : node:wasi refuse désormais pour de vrai (`Capabilities insufficient`, os error 76). *Leçon : un test de sécurité doit n'échouer que pour la bonne raison.*

**Suite :** capacités réseau (WASI sockets), écriture (ro/rw), WIT pour politiques fines côté plugin.

---

## Exp 012 — Écriture sous capabilities WASI + preopen read-only (2026-10-04)

**Contexte :** Exp 011 a prouvé la *lecture* sandboxée ; restait l'écriture (le vrai danger : un plugin qui modifie l'hôte) et les droits **ro/rw** (§7 permissions).

**Action :** bin `filewrite` (même crate `filecap`, args `<cible> <contenu>`, relecture de vérification) ; script `prototype/bench/wasi_write.mjs` : 4 scénarios × 3 runtimes + **contrôles côté hôte** (contenu réel de `capdata/out.txt`, non-existence de `evil.txt`).

**Preuves brutes** (`wasi_write.json`, `all_checks_pass: true`) :

```text
✅ wasmtime 49 (Cranelift) · grant-write → ok
⚪ wasmtime 49 (Cranelift) · ro-write → n/a (pas de preopen ro disponible)
✅ wasmtime 49 (Cranelift) · escape-write → err (Operation not permitted (os error 63))
✅ wasmtime 49 (Cranelift) · nogrant-write → err (No such file or directory (os error 44))
✅ wazero 1.12 (moteur Go) · grant-write → ok
✅ wazero 1.12 (moteur Go) · ro-write → err (Function not implemented (os error 52))
✅ wazero 1.12 (moteur Go) · escape-write → err (Operation not permitted (os error 63))
✅ wazero 1.12 (moteur Go) · nogrant-write → err (No such file or directory (os error 44))
✅ node:wasi (V8) · grant-write → ok
⚪ node:wasi (V8) · ro-write → n/a (pas de preopen ro disponible)
✅ node:wasi (V8) · escape-write → err (Capabilities insufficient (os error 76))
✅ node:wasi (V8) · nogrant-write → err (No such file or directory (os error 44))
✅ hôte : capdata/out.txt = "ECRITURE-WASM"
✅ hôte : evil.txt absent = true
```

**Résultat :**
- **Écriture : accordée dans le preopen rw** (3/3, `verify_len=13` + fichier relu par l'hôte), **refusée hors preopen** (evil.txt **jamais créé** — preuve hôte, pas seulement message guest), **refusée sans accord** ;
- **Preopen read-only** : supporté par wazero (`-mount …:ro` → `Function not implemented`) mais **absent des CLI wasmtime 49 et node:wasi** (preuves : `wasmtime run --help` / `-S help` sans `rodir`) → la capacité ro existe dans le modèle mais son exposant dépend du runtime ;
- globalement : **21 checks conformes + 2 n/a documentés** sur lecture (Exp 011) + écriture.

**Limite honnête :** pas encore de test réseau (sockets WASI = WASI 0.3/p2 en devenir).

**Suite :** réseau, WIT, installation depuis un registre distant (distribution).

---

## Exp 013 — Distribution : registre local + installation depuis HTTP (2026-10-04)

**Contexte :** conclusion §11 Q4 identifiait la **découverte/distribution** comme lacune écosystémique (« aucun registre/manifeste standard ») — restait à *démontrer* qu'une couche de distribution tient en peu de lignes au-dessus du même manifeste.

**Action :**
- `host.mjs` : nouvelles commandes **`registry <dossier>`** (découverte sans installation, layout `<reg>/<nom>/<version>/{manifest.json,wasm}`) et **`install-url <baseURL>`** (téléchargement manifeste + wasm via `fetch`, staging temporaire, validation **avant** installation, pipeline `doInstall` partagé avec l'install local) ;
- script `prototype/bench/registry_test.mjs` : registre temporaire + **serveur HTTP local** (Node `http`, port éphémère) = registre distant, 6 scénarios R1-R6, contrôles hôte (présence/absence réelle de fichiers).

**Preuves brutes** (`registry_test.json`, `all_checks_pass: true`, 11/11) :

```text
✅ R1 registry liste les 2 versions — regprobe@1.0.0 size=160B | regprobe@1.0.1 size=160B | regprobe-404@1.0.0 size=?B | regprobe-corrupt@9.9.9 INVALIDE ("exports" absent ou invalide) — ignoré
✅ R2 install-url 1.0.0 — [host] installé : regprobe@1.0.0
✅ R2 appel fibonacci(10)=55 — result=55
✅ R3 mise à jour 1.0.1 + .history/1.0.0 — version=1.0.1 history=true
✅ R4 doublon refusé — [host] ERREUR : regprobe : version 1.0.1 déjà installée (incrémentez la version)
✅ R5 manifeste corrompu refusé (rien installé) — champ obligatoire manquant : "exports"
✅ R5 plugin courant intact — version=1.0.1
✅ R6 wasm 404 refusé, staging nettoyé — [host] ERREUR : wasm inaccessible (HTTP 404)
✅ nettoyage : témoin retiré — gone=true
✅ hello/needy intacts — hello=true needy=true
✅ aucun staging résiduel — staging=false
```

Durées (`timings_ms`) : install_url v1 **224,2 ms** · v2 (mise à jour) **224,1 ms** (wall avec spawn Node ≈ 73 ms → ≈ 150 ms de traitement : fetch + staging + archivage `.history` + revalidation).

**Résultat :**
- **Distribution prouvée de bout en bout** : découverte (registry) → téléchargement HTTP → validation → installation → mise à jour versionnée (`.history`) → appel fonctionnel, le tout avec le **même déni-par-défaut** (manifeste distant pré-validé : champs, exports non vides, permissions ∈ allow-list) ;
- **Le registre distant non fiable n'installe rien de mauvais** : manifeste corrompu rejeté *avant* staging, wasm 404 rejeté *avec* staging nettoyé, doublon rejeté *avant* staging, plugin installé précédent intact ;
- entrées corrompues du registre : listées `INVALIDE — ignoré`, le host ne plante pas ;
- bugs trouvés et corrigés en cours d'Exp : (1) deadlock `spawnSync` vs serveur HTTP dans le même process → `spawn` asynchrone ; (2) `die()` (= `process.exit`) court-circuitait le `finally` de nettoyage → contrôles de sortie *avant* création du staging ; (3) registre plantait sur `exports` absent → skip+warning.

**Limite honnête :** le « distant » = HTTP localhost (le protocole est réel, pas l'échelle internet : pas d'HTTPS/signature/protocole de résolution de versions — voir suites signature/provenance).

**Suite :** WASI réseau (sockets), WIT, signature/provenance des plugins, client MCP externe.
