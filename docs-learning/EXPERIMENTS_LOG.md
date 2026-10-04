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

## Exp 004 — *(à venir)*
