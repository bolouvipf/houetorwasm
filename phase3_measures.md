# Phase 3 — Mesures comparatives (étude §8)

> Date des mesures : **2026-10-04** — **campagne canonique `10:51:47Z` (médiane de 9 spawns)** + Exp 007 (portabilité), Exp 008 (cycle de vie), Exp 009 (5 campagnes → fourchettes) · Machine : `win32 x64`, Node **v24.15.0**, Python **3.14**, clang **22.1.8 (LLVM-MinGW UCRT)**, **wasmtime 49.0.2**, **wazero 1.12**, plugin `hello@1.0.1` (Rust → `wasm32-unknown-unknown`), commande `fib-wasi` (Rust → `wasm32-wasip1` + `wasm32-wasip2`).
> Règle du lab : **preuves brutes d'abord** (`prototype/bench/results.json`, `peak_rss.json`, `portability.json`, `lifecycle.json`), interprétation ensuite. Scripts : `run_bench.mjs` + `peak_rss.ps1` + `portability.mjs` + `lifecycle.mjs`.

## 1. Méthodologie

Une **même fonctionnalité**, implémentée **5 fois** (étude §8 élargie à un runtime WASM dédié) :

```
fib(45) = 1134903170   (même résultat, vérifié dans chaque sortie JSON)
```

| Jambe | Fichier | Runtime / chaîne |
|---|---|---|
| 1. Natif | `fib.c` → `fib_native.exe` | clang MinGW `-O2`, exécution directe Windows |
| 2. Python | `fib.py` | CPython 3.14 |
| 3. JavaScript | `fib.js` | Node 24 (V8) |
| 4. WASM plugin (via host) | `hello` v1.0.1 | Rust `wasm32-unknown-unknown`, chargé par le **HOUETOR Plugin Host** (`host.mjs bench`) |
| 5. WASM commande (runtime dédié) | `fib_wasi/fib-wasi.wasm` | Rust `wasm32-wasip2`, exécuté par **wasmtime 49** (sans Node) |

**Protocole** : chaque variante = exécutions en processus neuf (spawn complet), on retient la **médiane** — **campagne canonique : 9 exécutions** (Exp 009 : 5 campagnes totales, absolus ×2-×3 selon l'état machine, **ratios stables** → on publie des fourchettes). Mesures internes par enfant (`first_call_us`, `compute_ms`, `per_call_ns`) + `wall_ms` mesuré par l'orchestrateur (création processus + init + calcul). **RSS pic** : WASI ne fournit pas de `maxrss` (`maxrss_kb: 0`) → mesure **externe** obligatoire via `peak_rss.ps1` (polling `PeakWorkingSet64` pendant l'exécution, médiane de 3).

**K par jambe** (cible ≈ 0,2-0,7 s) : natif 10 M · Python 100 k · JS 1 M · WASM-host 10 M · wasmtime 10 M. **Seule `per_call_ns` est inter-jambes** (normalisée par appel).

**Égalité des conditions** : même algorithme (boucle itérative), même `n`, accumulateur `sink` obligatoire (bug dead-code corrigé, Exp 004), nouveau processus à chaque run (aucun cache partagé).

## 2. Résultats bruts — performance (`node prototype\bench\run_bench.mjs`, campagne canonique n=9 + fourchettes Exp 009)

| Implémentation | artefact (o) | wall end-to-end (ms) | 1er appel (µs) | par appel (ns) — **canonique** | fourchette (5 campagnes) | K |
|---|---:|---:|---:|---:|---|---:|
| **Natif (C, MinGW)** | 88 064 | 80,47 | 0,1 | **7,2** | 7,2 – 17,8 | 10 M |
| **WASM commande (wasmtime 49)** | 135 641 | 186,64 | 5,0 | **13,9** | 9,5 – 27,2 | 10 M |
| **WASM plugin (HOUETOR / Node)** | **160** | 315,93 | **0,8** | 24,5 | 24,5 – 59,9 | 10 M |
| **JavaScript (Node 24)** | 991 | 95,44 | 29,2 | 34,3 | 34,3 – 80,5 | 1 M |
| **Python 3.14** | 1 735 | 242,34 | 3,8 | 1 593,6 | 1 594 – 4 128 | 100 k |

- Ratios **intra-campagne** (robustes, Exp 009) : wasmtime/natif **0,6-1,9×** (médiane ≈ 1,5×) · WASM-host vs JS **1,4-2,2× plus rapide** · Python **65-94×** (host) et **115-238×** (wasmtime) plus lent.
- WASM plugin (host) : `cold_load_ms` **0,9-2,0 ms** (compile + instantiate, preuve dans `results.json`).
- `wall_ms` inclut le spawn du runtime : Node ≈ 95-200 ms, Python ≈ 40-240 ms, natif ≈ 15-80 ms, wasmtime ≈ 60-190 ms → le classement « wall » dépend du K et du spawn : seule `per_call_ns` est comparable.

## 3. Résultats bruts — RSS pic (`prototype/bench/peak_rss.ps1`, médiane de 3)

```text
Natif (C)                    :  3 792 KB (samples: 3792, 3788, 3792)
Python 3.14                  : 16 340 KB (samples: 16340, 16004, 16304)
JavaScript (Node)            : 40 476 KB (samples: 40384, 40020, 40476)
WASM plugin (host Node)      : 41 380 KB (samples: 40932, 41380, 41364)
WASM commande (wasmtime)     : 14 384 KB (samples: 13780, 13600, 14384)
WASM commande (wazero)       : 16 100 KB (samples: 16100, 16092, 16072)
```

(Chaque run a exécuté le workload complet — aucun message d'erreur en sortie, vérifié. Variabilité inter-campagnes ≈ ±10 % : cf. limites §6.)

## 3bis. Résultats bruts — portabilité : même binaire, plusieurs runtimes + plusieurs OS (Exp 007 + 010)

`prototype/bench/portability.mjs` (Windows, médiane de 5, K = 10 M) → `portability.json`, `all_runtimes_agree: true` :

| Runtime (même binaire WASM) — Windows | 1er appel (µs) | par appel (ns) | résultat |
|---|---:|---:|---|
| wasmtime 49 (Cranelift) — composant WASI **p2** | 5,7 | **10,0** | `1134903170` |
| wasmtime 49 (Cranelift) — module WASI **p1** | 3,5 | 12,0 | `1134903170` |
| wazero 1.12 (moteur **Go**) — module WASI p1 | 0,6 | 13,9 | `1134903170` |
| node:wasi (moteur **V8**) — module WASI p1 | 0,7 | 23,0 | `1134903170` |

`prototype/bench/portability_os.sh` via WSL2 (Linux Ubuntu 26.04, Exp 010) → `portability_os.json`, exit 0 :

| Runtime — **Linux x86_64** (même fichier `/mnt/c/...`) | par appel (ns) | résultat |
|---|---:|---|
| wasmtime 49 (Cranelift) — module WASI p1 | 11,7 | `1134903170` |
| wazero 1.12 (moteur Go) — module WASI p1 | 14,1 | `1134903170` |
| node:wasi (V8) — module WASI p1 | 24,0 | `1134903170` |

**1 fichier → 2 OS (Windows + Linux) · 3 moteurs indépendants (Cranelift, Go, V8) · 2 formats (p1/p2) · 7 combinaisons, 1 résultat identique.**

## 3ter. Distribution — registre + install-url HTTP (Exp 013)

`host.mjs` ajoute `registry` (découverte, layout `<reg>/<nom>/<version>/manifest.json`) et `install-url` (fetch manifeste+wasm → staging → validation → installation versionnée). Test : `node prototype\bench\registry_test.mjs` → `registry_test.json`, **11/11 checks** (registre servi en HTTP local = « distant ») :

| Scénario | Verdict | Preuve hôte |
|---|---|---|
| Découverte registry (2 versions + 1 entrée corrompue) | ✅ | corrompue listée `INVALIDE — ignoré`, pas de plantage |
| install-url v1.0.0 + appel | ✅ | `regprobe@1.0.0` installé, `fibonacci(10)=55` |
| Mise à jour à distance v1.0.1 | ✅ | `.history/1.0.0` archivé, version courante 1.0.1 |
| Doublon (même version) | ✅ | refusé **avant** staging |
| Manifeste distant corrompu (exports manquant) | ✅ | rejeté **avant** staging, plugin installé intact |
| wasm distant 404 | ✅ | rejeté, staging nettoyé (aucun résidu) |
| Nettoyage final | ✅ | témoin retiré, `hello`/`needy` intacts, 0 staging résiduel |

Durées (`timings_ms`) : install distante **224,2 ms** (v1) / **224,1 ms** (update) — wall inclus spawn Node ≈ 73 ms ; traitement réel ≈ 150 ms (fetch + staging + archivage + revalidation).

**Intégrité (Exp 014)** : le manifeste peut (localement) et doit (à distance, `install-url`) épingler le **sha256** du wasm — vérifié à chaque `loadManifest` (list/info/run/bench), avant copie locale, et sur les octets reçus avant staging. Extension du même script → **15/15 checks** :

| Scénario intégrité | Verdict | Preuve |
|---|---|---|
| Distant **sans** sha256 | ✅ refusé | `champ "sha256" obligatoire pour une source distante` |
| Distant avec **fausse** empreinte | ✅ refusé | rien installé, staging nettoyé |
| Wasm **altéré après install** (1 octet flip) | ✅ refusé à l'exécution | `sha256 INCONGRU (manifeste 55bd…, fichier 58fe…)` |
| Plugin local **sans** sha256 (compat) | ✅ chargeable | `hello 2+3.5=5.5` |

**Lecture** : la couche distribution/découverte (lacune Q4) se comble en ~80 lignes au-dessus du manifeste existant, et l'intégrité en ~30 de plus (`node:crypto`, 0 dépendance) — mais tout reste **maison** : pas de standard de registre, sha256 = intégrité optimiste (registre compromis = manifeste compromis), signature asymétrique = suite (limite notée Exp 013-014).

## 4. Lecture par critère (étude §7)

| Critère | Preuve mesurée | Verdict |
|---|---|---|
| **Temps de chargement** | WASM plugin : compile+instantiate **0,9-2,0 ms** à froid ; spawn wasmtime ≈ 60-190 ms ; spawn natif ≈ 15-80 ms | ✅ le *chargement du plugin* est négligeable face à l'init du runtime |
| **Temps d'exécution** | canonique : natif **7,2** · wasmtime **13,9** · WASM-via-Node **24,5** · JS **34,3** · Python **1 593,6** ns ; ratios sur 5 campagnes | wasmtime ≈ **0,6-1,9× le natif** (médiane 1,5×) ; WASM-via-host **1,4-2,2× plus rapide que le JS** ; Python **65-238×** plus lent |
| **Mémoire (RSS pic)** | natif **3,8** · wasmtime **14,4** · wazero **16,1** · Python **16,3** · Node **40,5** · host WASM **41,4** MB | ✅ un runtime WASM dédié coûte **2,5-3× moins que Node**, stable entre moteurs ; le plugin = **1 Mo** de mémoire linéaire |
| **Taille du plugin** | plugin réactif **160 o** (vs 88 064 o natif, 991 o js, 135 641 o commande WASI avec std Rust) | ✅ un *plugin* minimal = **160 o** ; le poids vient du runtime/std, pas du plugin |
| **Isolation** | Exp 003/005 : imports refusés (`deny-by-default`), 2 barrières indépendantes ; Exp 011-012 : lecture/écriture sandboxées (évasion `../` refusée, `evil.txt` jamais créé — 3 moteurs) | ✅ |
| **Contrôle des permissions** | manifeste ∩ allow-list hôte (`HOST_ALLOWED = []`) + **capabilities WASI** (Exp 011 : grant → `ok`, évasion → refus, aucun accord → refus, 9/9 sur 3 moteurs ; Exp 012 : écriture rw ok / hors-preopen refusée / ro=`:ro` bloqué chez wazero) | ✅ (applicatif + système, lecture+écriture) |
| **Temps d'installation / mise à jour** | Exp 008 : install **18,5 ms** fs net, update (v1→v2 + archivage) **24,7 ms**, remove **14,2 ms** (wall ≈ 90-100 ms avec spawn Node 73 ms) | ✅ local ≈ dizaines de ms |
| **Retrait / versions / install** | Exp 003 (fonctionnel : `.history/`, refus doublon) + Exp 008 (chronométré) | ✅ |
| **Portabilité** | même fichier exécuté sur **2 OS** (Windows, Linux/WSL2) par **7 combinaisons** exécuteur×OS — **3 moteurs** (wasmtime-Cranelift p1+p2, wazero-Go, node:wasi-V8), même résultat `1134903170` (Exp 007+010, `portability.json` + `portability_os.json`) | ✅ **multi-OS démontrée** (macOS/navigateur = suite) |
| **Complexité d'intégration** | hôte ≈ 250 lignes JS, 0 dépendance ; bridge MCP ≈ 150 lignes, 0 dépendance | ✅ faible |
| **Gestion des dépendances** | imports refusés sauf permissions explicites ; WIT/composants = suite | 🟡 |

## 5. Réponse à l'étude §8 (« meilleur qu'un plugin natif/Python/JS ? »)

**Avec un runtime WASM dédié, l'écart au natif tombe à ≈ 1,5× (médiane ; fourchette 0,6-1,9× — parfois égalité, cf. Exp 009)**, contre 1,5-3,4× quand le même plugin passe par l'hôte Node (surcoût : frontière JS↔WASM + boucle hôte). Le WASM n'est jamais vainqueur brut, mais c'est le seul format qui cumule :

1. **vs Natif** : ≈ 1,5× de vitesse **en échange de** portabilité (même binaire sur 3 moteurs), sandbox par construction, artefact **160 o** vs 88 Ko, et **aucune plateforme par cible**.
2. **vs JS** : WASM est **1,4-2,2× plus rapide** à l'exécution (host : 24,5 vs 34,3 ns en canonique) **avec une sandbox** ; le JS a une startup rapide mais aucune isolation par défaut.
3. **vs Python** : **65-238×** plus rapide — Python sert ici de témoin « scripting embarqué » : acceptable en startup, hors compétition en calcul.
4. **Le coût réel est le runtime** : 14 MB (wasmtime) / 16 MB (wazero) à 41 MB (Node) — **payé une fois pour N plugins**, coût marginal par plugin = 160 o + 1-2 ms de compile.

**Conclusion §8** : pour un système universel de plugins, WASM (runtime dédié) = exécution **à ≈ 1,5× du natif (médiane, fourchette 0,6-1,9×)** + distribution 160 o + isolation prouvée + appel standardisé — le meilleur *triangle* compromis, pas le vainqueur sur chaque axe. Le natif gagne si l'on accepte de perdre portabilité + isolation ; le JS gagne en intégration web mais pas en sécurité.

## 6. Limites expérimentales (honnêteté scientifique)

- **K différent par jambe** : seule `per_call_ns` est inter-jambes ; `compute_ms` n'est comparable qu'à l'intérieur d'une jambe.
- **Représentations numériques** : C/WASM `i64/i32`, JS `double` (fib(45) < 2^53 → exact), Python entier arbitraire ; même résultat vérifié.
- **Une machine, une charge** : fib est *compute-bound* ; workload mémoire/données = autres ratios. Pas de mesure multi-thread (WASI 0.3 n'a pas encore threads — H §Phase 2).
- **`wall_ms` = spawn inclus** : comparer les « wall » entre runtimes de startup différent est trompeur → raison d'exister de `compute_ms`.
- **`first_call_us`** : JIT/compile inclus (JS ≈ 29-63 µs, wasmtime ≈ 4-10 µs avec init WASI, host ≈ 0,8-2 µs = compile du plugin mesurée à part dans `cold_load_ms`).
- **Artefacts non comparables en taille** : `fib-wasi.wasm` (135 Ko) embarque std Rust + WASI ; le **plugin 160 o** est le vrai réflexe « plugin ».
- **Variabilité inter-campagnes (Exp 009)** : **5 campagnes le même jour** → absolus ×2-×3 (nativ 7,2-17,8 ns ; wasmtime 9,5-27,2 ns) selon fréquence/charge OS/JIT ; **ratios stables** (c'est ce qu'on publie) ; artefacts et RSS stables à ±5 %. Méthode : `BENCH_RUNS=9` + fourchettes, jamais un point unique.

## 7. Reproductibilité

```powershell
# 1. Jambe native (LLVM-MinGW, winget, 2026-10-04)
$bin = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260616-ucrt-x86_64\bin"
& "$bin\clang.exe" prototype\bench\fib.c -O2 -o prototype\bench\fib_native.exe -lpsapi

# 2. Jambes WASI (wasmtime p2 + p1, wazero p1)
& "$env:USERPROFILE\.cargo\bin\rustup.exe" target add wasm32-wasip1 wasm32-wasip2
& "$env:USERPROFILE\.cargo\bin\cargo.exe" build --release --target wasm32-wasip1 --manifest-path prototype\bench\fib_wasi\Cargo.toml
& "$env:USERPROFILE\.cargo\bin\cargo.exe" build --release --target wasm32-wasip2 --manifest-path prototype\bench\fib_wasi\Cargo.toml
# wazero (Exp 007) : https://github.com/tetratelabs/wazero/releases/download/v1.12.0/wazero_1.12.0_windows_amd64.zip
#   → extraire dans %TEMP%\opencode\wazero\wazero.exe (ou `wazero` sur le PATH)

# 3. Comparatif (5 jambes ; campagne canonique : BENCH_RUNS=9) → results.json
$env:BENCH_RUNS="9"; node prototype\bench\run_bench.mjs

# 4. RSS pic (médiane de 3, polling externe) → peak_rss.json
powershell -NoProfile -ExecutionPolicy Bypass -File prototype\bench\peak_rss.ps1

# 5. Portabilité : même binaire, 4 exécuteurs (Windows) → portability.json
node prototype\bench\portability.mjs

# 6. Portabilité MULTI-OS : même binaire sous WSL2/Ubuntu → portability_os.json
#    (prérequis Linux — une fois — dans WSL :
#     mkdir -p ~/tools && cd ~/tools
#     curl -sL https://github.com/bytecodealliance/wasmtime/releases/download/v49.0.2/wasmtime-v49.0.2-x86_64-linux.tar.xz | tar xJ
#     curl -sL -o wazero.tar.gz https://github.com/tetratelabs/wazero/releases/download/v1.12.0/wazero_1.12.0_linux_amd64.tar.gz && tar xzf wazero.tar.gz && rm wazero.tar.gz && chmod +x wazero)
powershell -NoProfile -ExecutionPolicy Bypass -File prototype\bench\portability_os.ps1

# 7. Capabilities fichier WASI (Exp 011-012) : lecture+écriture, grant/escape/ro/nogrant → wasi_caps.json / wasi_write.json
#    (modules : cargo build --release --target wasm32-wasip1 --manifest-path prototype\samples\filecap\Cargo.toml)

# 8. Distribution + intégrité (Exp 013-014) : registre + install-url + épinglage sha256 (15/15) → registry_test.json
node "prototype\bench\registry_test.mjs"
node prototype\bench\wasi_caps.mjs
node prototype\bench\wasi_write.mjs
```

Env : `BENCH_RUNS`, `BENCH_N`, `BENCH_K`. wasmtime résolu automatiquement depuis `~/.local/bin/wasmtime-*/`.
