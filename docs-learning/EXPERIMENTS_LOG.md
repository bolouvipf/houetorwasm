# EXPERIMENTS_LOG — Journal des expériences

> Format : `## Exp 00N — Titre (date)` · Contexte · Action · **Preuves brutes** · Résultat · Suite.
> Preuve brute obligatoire : sortie de commande, chiffre mesuré, URL + date de source.

---

## Exp 001 — Phase 1 : état de l'art WASM/WASI/Component Model (2026-10-04)

**Contexte :** démarrage de l'étude ; question §2.A « la technologie a-t-elle les propriétés nécessaires à un système universel de plugins ? »

**Action :** recherches web multicouches (spécifications, Bytecode Alliance, WASI.dev, benchmarks runtimes, systèmes de plugins existants) + rédaction de `phase1_etat_de_l_art.md`.

**Preuves brutes (extrait daté) :**
- WASI 0.2 voté le **2024-01-25** ; **WASI 0.3 publié le 2026-06-11** (`async func`, `stream<T>`, `future<T>` ; `wasi:io` supprimé) — sources : wasi.dev/releases, github.com/WebAssembly/WASI.
- WASI 0.3.1 : `map<K,V>` adopté le **2026-08-06** — wasi.dev/releases.
- Bytecode Alliance, *The Road to Component Model 1.0* (**2026-06-08**) : Component Model et WASI « déjà largement utilisés en production » ; WASI 1.0 suivra la 1.0 du Component Model.
- Benchmarks runtimes 2026-01-15 : Wasmtime cold start **5,2 ms** / exécution 10,4 ms ; Wasmer 6,8/12,1 ; wazero 4,5/18,7 ; WasmEdge 8,1/15,3 ; Wasm3 2,1/45,2 — wasmruntime.com/en/benchmarks.
- Adoption navigateur : **~96 %** (caniuse, juillet 2026) ; **~5,5 % des pages Chrome** chargent du WASM (State of WebAssembly 2026).
- Sécurité : capabilities WASI deny-by-default, handles infalsifiables (wasi.dev/security) ; preuve formelle sandboxing = USENIX Security 2022 (vWasm/rWasm) ; **contre-exemple** : Node.js WASI « ne pas exécuter de code non fiable » (node/doc/api/wasi.md).
- Chaque système de plugins a redéfini SON contrat : Extism (manifest+PDK), proxy-wasm ABI 0.2.1 (spéc fragile), Shopify Wasm API (NaN-boxing), wasmCloud (WIT) → **confirmation empirique de la question C**.

**Résultat :** réponse **nuancée oui/non** (§8 de `phase1_etat_de_l_art.md`) : ✅ mécanique / ❌ écosystémique.

**Suite :** Phase 2 (cartographie par domaine) ; installation toolchain pour Phase 3.

---

## Exp 002 — *(à venir)*
