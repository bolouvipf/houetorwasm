# Phase 3 — Mesures comparatives (étude §8)

> Date des mesures : **2026-10-04 06:45 UTC** · Machine : `win32 x64`, Node **v24.15.0**, Python **3.14**, clang **22.1.8 (LLVM-MinGW UCRT)**, plugin `hello@1.0.1` (Rust → `wasm32-unknown-unknown`).
> Règle du lab : **preuves brutes d'abord** (`prototype/bench/results.json`), interprétation ensuite. Script reproductible : `prototype/bench/run_bench.mjs`.

## 1. Méthodologie

Une **même fonctionnalité**, implémentée **4 fois** (étude §8) :

```
fib(45) = 1134903170   (même résultat, vérifié dans chaque sortie JSON)
```

| Jambe | Fichier | Runtime / chaîne |
|---|---|---|
| 1. Natif | `fib.c` → `fib_native.exe` | clang MinGW `-O2`, exécution directe Windows |
| 2. Python | `fib.py` | CPython 3.14 |
| 3. JavaScript | `fib.js` | Node 24 (V8) |
| 4. WASM (plugin) | `hello` v1.0.1 | compilé Rust `--release`, chargé par le **HOUETOR Plugin Host** (`host.mjs bench`) |

**Protocole** : chaque variante est exécutée **5 fois en processus neuf** (spawn complet) ; on retient la **médiane**. Chaque exécution mesure elle-même : `first_call_us` (premier appel), `compute_ms` (boucle de K appels), `per_call_ns` (normalisé par appel), `maxrss_kb` (pic de mémoire résidente). Le orchestrator mesure `wall_ms` = **temps end-to-end** (création de processus + initialisation + calcul).

**K par jambe** (visé ≈ 0,2-0,7 s de calcul) : natif 10 M · Python 100 k · JS 1 M · WASM 10 M. Seul `per_call_ns` est comparable entre jambes ; `compute_ms` l'est à l'intérieur d'une jambe.

**Égalité des conditions** : même algorithme (boucle itérative), même `n`, `sink`/accumulateur obligatoire pour empêcher l'élimination du code mort (bug réel, voir Exp 004), aucune mise en cache entre runs (chaque run = nouveau processus).

## 2. Résultats bruts (médianes, sortie de `node prototype\bench\run_bench.mjs`)

| Implémentation | artefact (o) | wall end-to-end (ms) | 1er appel (µs) | par appel (ns) | RSS max (KB) | K |
|---|---:|---:|---:|---:|---:|---:|
| **Natif (C, MinGW)** | 88 064 | **209,37** | **0,2** | **19,2** | **3 660** | 10 M |
| **Python 3.14** | 1 735 | 802,05 | 11,1 | 5 718 | 16 232 | 100 k |
| **JavaScript (Node 24)** | 991 | 284,41 | 92,8 | 112,3 | 40 980 | 1 M |
| **WASM plugin (HOUETOR host)** | **160** | 894,25 | 1,9 | 70,7 | 41 060 | 10 M |

Relevé WASM détaillé (preuve brute, `run hello/bench`) :

```json
{"plugin":"hello@1.0.1","call":"fibonacci","args":[45],"result":1134903170,
 "cold_load_ms":4.207,"compile_ms":1.551,"instantiate_ms":0.244,
 "compute_ms":706.71,"per_call_ns":70.7,"wasm_bytes":160,"memory_bytes":1048576}
```

Fichier complet : **`prototype/bench/results.json`** (avec date, machine, statut de chaque jambe).

## 3. Lecture par critère (étude §7)

| Critère | Preuve mesurée | Verdict |
|---|---|---|
| **Temps de chargement** | WASM : compile+instantiate **4,2 ms** à froid ; end-to-end WASM **894 ms** dont ~190 ms = spawn Node ; natif : spawn seul (~18 ms) | ✅ le *chargement du plugin WASM* est négligeable face à l'init du runtime hôte |
| **Temps d'exécution** | par appel : natif **19,2 ns** · WASM **70,7 ns** · JS **112,3 ns** · Python **5 718 ns** | WASM = **3,7× plus lent que le natif**, **1,6× plus rapide que le JS pur**, **81× plus rapide que Python** |
| **Mémoire (RSS pic)** | natif 3,6 MB · Python 16 MB · Node/JS 41 MB · hôte WASM 41 MB | ⚠️ le plugin WASM lui-même = **1 Mo** ; les 41 MB sont le coût **du runtime hôte (Node)**, pas du plugin |
| **Taille du plugin** | **160 o** (WASM) vs 991 o (js) vs 1 735 o (py) vs 88 064 o (exe) | ✅ **550× plus léger que l'exécutable natif** |
| **Isolation** | Exp 003 : imports refusés (`deny-by-default`), permissions non accordées → refus | ✅ démontré par sortie brute (Exp 003) |
| **Contrôle des permissions** | manifeste `permissions` ∩ allow-list hôte (`HOST_ALLOWED = []`) | ✅ |
| **Retrait / versions / install** | Exp 003 (`.history/`, refus doublon) | ✅ |
| **Portabilité** | même `hello.wasm` chargé par Node (V8) ici — pas encore rejoué sous wasmtime/Firefox | 🟡 à démontrer (suite) |
| **Complexité d'intégration** | hôte MVP = **~250 lignes JS**, zéro dépendance ; accès WASM = 1 API standard (`WebAssembly`) | ✅ faible pour un hôte minimal |
| **Temps d'installation / mise à jour** | non chronométré (fs local, ms) | ⬜ à instrumenter |
| **Gestion des dépendances** | MVP : aucun import hôte sauf permissions explicites | ⬜ WIT/composants = Phase 3 suite |

## 4. Réponse à l'étude §8 (« est-ce meilleur qu'un plugin natif/Python/JS ? »)

**Le WASM n'est pas « plus rapide que le natif »** — il y a un **facteur 3,7** — mais il tient un **triangle de compromis qu'aucune des 3 autres jambes n'atteint** :

1. **vs Natif** : le natif gagne tout (~4× exécution, ~18 ms de spawn) mais coûte **88 KB par plugin, une plateforme par cible** (x64/arm64, .exe vs .so) et **aucune isolation standard** (un plugin natif = code machine qui fait ce qu'il veut).
2. **vs Python/JS** : WASM est **plus rapide à l'exécution que le JS pur (1,6×)** et **81× que Python**, avec un artefact **160 o** et une **sandbox par construction** — alors que JS/Python exécutent avec les droits du processus hôte.
3. **Le vrai coût WASM est le runtime hôte** : 41 MB de RSS et ~190 ms de spawn Node sont payés *une fois pour tous les plugins*. Pour un hôte avec N plugins, le coût marginal par plugin = **160 o + 4 ms de compile**.

**Conclusion nuancée (à retenir dans le mémoire)** : pour un *système universel de plugins*, WASM est le premier format qui coche simultanément exécution proche du natif (70 ns), distribution minuscule (160 o), isolation éprouvée et appel standardisé ; le natif reste le vainqueur brut si l'on accepte de perdre portabilité + isolation.

## 5. Limites expérimentales (honnêteté scientifique)

- **K différent par jambe** : seule la colonne `per_call_ns` est inter-jambes (normalisée ; `compute_ms` non comparable directement).
- **Représentations numériques différentes** : C/WASM en `i64/i32`, JS en `double` (fib(45) < 2^53 → exact), Python en entier arbitraire. Même résultat vérifié, régime de nombres équivalent mais pas identique.
- **Une seule machine, une seule charge** : fib est *compute-bound* ; un workload mémoire/strings donnerait d'autres ratios. Pas de mesure multi-thread.
- **La jambe WASM passe par Node** (hôte MVP JS) : les 41 MB RSS sont ceux de Node. Une mesure via **wasmtime CLI** isolerait le coût réel du runtime WASM → **suite prévue**.
- **`first_call_us` JS (92,8 µs)** inclut probablement la première compilation JIT de `fib` — cold-start JS mal pénalisé, à creuser avec des runs plus longs.

## 6. Reproductibilité

```powershell
# 1. Compiler la jambe native (LLVM-MinGW, winget installé le 2026-10-04)
$bin = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260616-ucrt-x86_64\bin"
& "$bin\clang.exe" prototype\bench\fib.c -O2 -o prototype\bench\fib_native.exe -lpsapi

# 2. Lancer le comparatif (médiane de 5 spawns par jambe)
node prototype\bench\run_bench.mjs
# → table markdown + prototype\bench\results.json
```

Env variables : `BENCH_RUNS` (nb de runs), `BENCH_N` (n de fib), `BENCH_K` (itérations, lu par chaque implémentation).
