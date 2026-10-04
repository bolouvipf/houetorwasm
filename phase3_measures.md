# Phase 3 — Mesures comparatives (étude §8)

> Date des mesures : **2026-10-04** (run final `06:58:40Z`) · Machine : `win32 x64`, Node **v24.15.0**, Python **3.14**, clang **22.1.8 (LLVM-MinGW UCRT)**, **wasmtime 49.0.2**, plugin `hello@1.0.1` (Rust → `wasm32-unknown-unknown`), commande `fib-wasi` (Rust → `wasm32-wasip2`).
> Règle du lab : **preuves brutes d'abord** (`prototype/bench/results.json`, `prototype/bench/peak_rss.json`), interprétation ensuite. Scripts : `run_bench.mjs` + `peak_rss.ps1`.

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

**Protocole** : chaque variante = **5 exécutions en processus neuf** (spawn complet), on retient la **médiane**. Mesures internes par enfant (`first_call_us`, `compute_ms`, `per_call_ns`) + `wall_ms` mesuré par l'orchestrateur (création processus + init + calcul). **RSS pic** : WASI ne fournit pas de `maxrss` (`maxrss_kb: 0`) → mesure **externe** obligatoire via `peak_rss.ps1` (polling `PeakWorkingSet64` pendant l'exécution, médiane de 3).

**K par jambe** (cible ≈ 0,2-0,7 s) : natif 10 M · Python 100 k · JS 1 M · WASM-host 10 M · wasmtime 10 M. **Seule `per_call_ns` est inter-jambes** (normalisée par appel).

**Égalité des conditions** : même algorithme (boucle itérative), même `n`, accumulateur `sink` obligatoire (bug dead-code corrigé, Exp 004), nouveau processus à chaque run (aucun cache partagé).

## 2. Résultats bruts — performance (`node prototype\bench\run_bench.mjs`, médianes)

| Implémentation | artefact (o) | wall end-to-end (ms) | 1er appel (µs) | par appel (ns) | K |
|---|---:|---:|---:|---:|---:|
| **Natif (C, MinGW)** | 88 064 | **193,75** | **0,2** | **17,8** | 10 M |
| **WASM commande (wasmtime 49)** | 135 135 | 332,86 | 9,5 | **27,2** | 10 M |
| **WASM plugin (HOUETOR / Node)** | **160** | 760,69 | **2,0** | 59,9 | 10 M |
| **JavaScript (Node 24)** | 991 | 199,86 | 63,5 | 80,5 | 1 M |
| **Python 3.14** | 1 735 | 618,30 | 10,9 | 4 127,6 | 100 k |

- WASM plugin (host) : `cold_load_ms: 1,971` (compile + instantiate, preuve dans `results.json`).
- `wall_ms` inclut le spawn du runtime : Node ≈ 160-200 ms, Python ≈ 40 ms, natif ≈ 15 ms, wasmtime ≈ 60 ms → d'où le classement « wall » contre-intuitif (JS plus rapide que WASM-Node **uniquement** parce que son calcul de 1 M d'itérations est plus court).

## 3. Résultats bruts — RSS pic (`prototype/bench/peak_rss.ps1`, médiane de 3)

```text
Natif (C)                    :  4 196 KB (samples: 4192, 3792, 4196)
Python 3.14                  : 16 268 KB (samples: 16232, 16268, 16268)
JavaScript (Node)            : 40 328 KB (samples: 40032, 40020, 40328)
WASM plugin (host Node)      : 41 424 KB (samples: 41424, 41360, 41332)
WASM commande (wasmtime)     : 13 736 KB (samples: 13612, 13704, 13736)
```

(Chaque run a exécuté le workload complet — aucun message d'erreur en sortie, vérifié.)

## 4. Lecture par critère (étude §7)

| Critère | Preuve mesurée | Verdict |
|---|---|---|
| **Temps de chargement** | WASM plugin : compile+instantiate **1,97 ms** à froid ; spawn wasmtime ≈ 60 ms ; spawn natif ≈ 15 ms | ✅ le *chargement du plugin* est négligeable face à l'init du runtime |
| **Temps d'exécution** | par appel : natif **17,8** · wasmtime **27,2** · WASM-via-Node **59,9** · JS **80,5** · Python **4 127,6** ns | WASM = **1,5× le natif** (wasmtime) à **3,4×** (via Node) ; **1,3-1,7× plus rapide que le JS pur** ; **69-152× Python** |
| **Mémoire (RSS pic)** | natif **4,2** · wasmtime **13,7** · Python **16,3** · Node **40,3** · host WASM **41,4** MB | ✅ un runtime WASM dédié coûte **3× moins que Node** ; le plugin lui-même = **1 Mo** de mémoire linéaire |
| **Taille du plugin** | plugin réactif **160 o** (vs 88 064 o natif, 991 o js, 135 135 o commande WASI avec std Rust) | ✅ un *plugin* minimal = **160 o** ; le poids vient du runtime/std, pas du plugin |
| **Isolation** | Exp 003/005 : imports refusés (`deny-by-default`), 2 barrières indépendantes | ✅ |
| **Contrôle des permissions** | manifeste ∩ allow-list hôte (`HOST_ALLOWED = []`) | ✅ |
| **Retrait / versions / install** | Exp 003 (`.history/`, refus doublon) | ✅ |
| **Portabilité** | **même charge** exécutée par **2 runtimes WASM différents** (V8/Node ET wasmtime/Cranelift) avec le même résultat `1134903170` | 🟡→✅ partielle (2 runtimes OS Windows ; un 3ᵉ OS/navigateur = suite) |
| **Complexité d'intégration** | hôte ≈ 250 lignes JS, 0 dépendance ; bridge MCP ≈ 150 lignes, 0 dépendance | ✅ faible |
| **Temps d'installation / mise à jour** | non chronométré (fs local) | ⬜ à instrumenter |
| **Gestion des dépendances** | imports refusés sauf permissions explicites ; WIT/composants = suite | 🟡 |

## 5. Réponse à l'étude §8 (« meilleur qu'un plugin natif/Python/JS ? »)

**Avec un runtime WASM dédié, l'écart au natif tombe à 1,5×** (27,2 vs 17,8 ns) — bien loin des 3,4× mesurés quand le même plugin passe par l'hôte Node (surcoût : frontière JS↔WASM + boucle hôte). Le WASM n'est jamais vainqueur brut, mais c'est le seul format qui cumule :

1. **vs Natif** : 1,5× de vitesse **en échange de** portabilité (même binaire), sandbox par construction, artefact **160 o** vs 88 Ko, et **aucune plateforme par cible**.
2. **vs JS** : WASM est **1,3× plus rapide** à l'exécution (59,9 vs 80,5 ns) **avec une sandbox** ; le JS a la même vitesse de spawn mais aucune isolation par défaut.
3. **vs Python** : **69-152×** plus rapide — Python sert ici de témoin « scripting embarqué » : acceptable en startup, hors compétition en calcul.
4. **Le coût réel est le runtime** : 13,7 MB (wasmtime) à 41 MB (Node) — **payé une fois pour N plugins**, coût marginal par plugin = 160 o + 2 ms de compile.

**Conclusion §8** : pour un système universel de plugins, WASM (runtime dédié) = exécution à 1,5× du natif + distribution 160 o + isolation prouvée + appel standardisé — le meilleur *triangle* compromis, pas le vainqueur sur chaque axe. Le natif gagne si l'on accepte de perdre portabilité + isolation ; le JS gagne en intégration web mais pas en sécurité.

## 6. Limites expérimentales (honnêteté scientifique)

- **K différent par jambe** : seule `per_call_ns` est inter-jambes ; `compute_ms` n'est comparable qu'à l'intérieur d'une jambe.
- **Représentations numériques** : C/WASM `i64/i32`, JS `double` (fib(45) < 2^53 → exact), Python entier arbitraire ; même résultat vérifié.
- **Une machine, une charge** : fib est *compute-bound* ; workload mémoire/données = autres ratios. Pas de mesure multi-thread (WASI 0.3 n'a pas encore threads — H §Phase 2).
- **`wall_ms` = spawn inclus** : comparer les « wall » entre runtimes de startup différent est trompeur → raison d'exister de `compute_ms`.
- **`first_call_us` JS (63,5 µs)** inclut la 1ʳᵉ compilation JIT ; wasmtime (9,5 µs) inclut l'init WASI.
- **Artefacts non comparables en taille** : `fib-wasi.wasm` (135 Ko) embarque std Rust + WASI ; le **plugin 160 o** est le vrai réflexe « plugin ».
- **Variabilité inter-runs** : deux campagnes (06:45 et 06:58) donnent ±20 % sur `per_call_ns` (bruit OS/JIT) — ordres de grandeur stables, ratios stables.

## 7. Reproductibilité

```powershell
# 1. Jambe native (LLVM-MinGW, winget, 2026-10-04)
$bin = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260616-ucrt-x86_64\bin"
& "$bin\clang.exe" prototype\bench\fib.c -O2 -o prototype\bench\fib_native.exe -lpsapi

# 2. Jambe wasmtime (commande WASI)
& "$env:USERPROFILE\.cargo\bin\cargo.exe" build --release --target wasm32-wasip2 --manifest-path prototype\bench\fib_wasi\Cargo.toml

# 3. Comparatif (5 jambes, médiane de 5 spawns) → results.json
node prototype\bench\run_bench.mjs

# 4. RSS pic (médiane de 3, polling externe) → peak_rss.json
powershell -NoProfile -ExecutionPolicy Bypass -File prototype\bench\peak_rss.ps1
```

Env : `BENCH_RUNS`, `BENCH_N`, `BENCH_K`. wasmtime résolu automatiquement depuis `~/.local/bin/wasmtime-*/`.
