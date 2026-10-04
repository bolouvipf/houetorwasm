# LEARNING_STATE — État actuel et point de reprise

> Dernière mise à jour : **2026-10-04** (session 2 — fin de session)

## Fait ✅

1. **Phase 1 — État de l'art livrée** → `phase1_etat_de_l_art.md` (sources datées, matrice de maturité 13 lignes).
   - **Conclusion** : propriétés *mécaniques* ✅ / propriétés *écosystémiques* ❌ → terrain du prototype.
2. **Phase 2 — Cartographie livrée** → `phase2_cartographie.md` (8 domaines A–H, sources vérifiées le 2026-10-04).
   - **Conclusion** : **8 contrats hétérogènes** pour un format « universel » — la question C est confirmée ; Docker Wasm abandonné 🔴, APISIX WASM gelé 🟡, adoption web réelle 0,35 %.
3. **Phase 3 — HOUETOR Plugin Host + mesures** → `prototype/host/host.mjs` + `phase3_measures.md`.
   - **8/8 étapes du §4** (Exp 003) ; **comparatif §8 à 5 jambes** (Exp 004+006+009) : campagne canonique n=9 → natif **7,2** · wasmtime **13,9** · WASM-Node **24,5** · JS **34,3** · Python **1 594** ns/appel, **fourchettes sur 5 campagnes** (ratios stables : wasmtime ≈ natif ×1,5 [0,6-1,9], host 1,4-2,2× JS, Python 65-238×) ; RSS pic : wasmtime **14,4 Mo** / wazero **16,1 Mo** vs Node **40,5 Mo** ; plugin **160 o**, cold load **1-2 ms**.
   - **Portabilité ✅ multi-OS** (Exp 007+010) : **même binaire → 2 OS (Windows + Linux/WSL2), 7 combinaisons exécuteur×OS, 3 moteurs indépendants** (Cranelift p1+p2, Go/wazero, V8/node:wasi), résultat identique `1134903170` (`portability.json` + `portability_os.json`).
   - **Cycle de vie chronométré ✅** (Exp 008) : install **18,5 ms**, update **24,7 ms**, remove **14,2 ms** fs net (baseline spawn Node 73,3 ms ; doublon refusé, `hello` intact) → `lifecycle.json`.
   - **Capabilities fichier WASI ✅** (Exp 011+012) : lecture ET écriture — accord → `ok`, évasion `data/../` → refusée (3 moteurs : os 63/63/76), aucun accord → refus, preopen `ro` → écriture bloquée (wazero), `evil.txt` jamais créé ; **21 checks + 2 n/a** (`wasi_caps.json` + `wasi_write.json`, modules `prototype/samples/filecap`).
   - **Distribution ✅** (Exp 013) : commandes `registry` (découverte layout `<reg>/<nom>/<version>`) + `install-url` (fetch HTTP → staging → validation → install versionnée) ; serveur HTTP local = registre distant ; **11/11 checks** (doublon/corruption/404 refusés proprement, `.history` archivé), install **224 ms** → `registry_test.json` ; lacune Q4 « distribution » comblée côté prototype (standard mondial toujours absent).
   - **Intégrité ✅** (Exp 014) : épinglage **sha256** du wasm au manifeste — obligatoire pour `install-url`, vérifié à chaque chargement + avant copie locale ; commande `hash` ; **15/15 checks** (distant sans sha refusé, fausse empreinte refusée, altération post-install détectée à l'exécution, plugins sans sha compat) → `registry_test.json` ; `node:crypto` = 0 dépendance.
   - **Provenance ✅** (Exp 016) : signature **Ed25519** des manifestes (`keygen`/`sign` → `manifest.sig`), confiance = `HOUETOR_TRUST_KEYS` (PEM), `install-url` exige **sha256 + sig** sur octets bruts, sig présent sans clé = **refus explicite** ; **12/12 checks** (`sig_test.json`) + régressions 15/15/8/8 verts. **Limite** : distribution des clés = humaine (pas de PKI) ; bruit cosmétique Node/Windows `UV_HANDLE_CLOSING` (stderr, sans impact).
   - **Composants WIT ✅** (Exp 018) : plugin `witcalc` (**composant** `houetor:calc/calc@0.1.0`, 94 668 o, `wasm32-wasip2`) — WIT et surface de capabilities **lus dans le binaire** (`host wit` / `host types`), exécution **WAVE** (`add(2, 3.5)` → 5.5), refus de type/arité **avant** exécution, **deny-by-default statique** (composant fs sans permission = ne se charge pas) + **double verrou fs** (`HOUETOR_PREOPENS`) ; **20/20 checks** → `component_test.json`.
   - **Isolation temporelle ✅** (Exp 020) : `HOUETOR_FUEL` / `HOUETOR_TIMEOUT` → `-W fuel=` / `-W timeout=` (wasmtime) — plugin malveillant `spinhog` (boucle infinie) : **60,2 s de blocage sans limites → coupé en 313 ms (fuel) / 500 ms (timeout)**, appels légitimes intacts sous la même limite, valeurs invalides = refus fail-closed ; **12/12 checks** → `fuel_test.json`. **Limite** : chemin module core in-process non fuel-limable (refusé, pas ignoré) ; mémoire non plafonnée.
4. **Phase 4 — Pont MCP** → `prototype/mcp/bridge.mjs` + `phase4_mcp_bridge.md`.
   - **8/8** (Exp 005) : `tools/list` **généré automatiquement depuis les manifestes** ; défense en profondeur (outil exposé, appel refusé par sandbox).
   - **9/9 policy** (Exp 015) : filtrage allow/deny via `HOUETOR_MCP_POLICY` (deny prime, hors-allow refusé **avant** le host, policy cassée = **fail-closed**, sans variable = rétrocompat) → `policy_test.json` — **3ᵉ barrière** (bridge → policy → host).
   - **Outils typés ✅** (Exp 019) : pour un composant, `tools/list` expose un `inputSchema` à **propriétés nommées typées** `{a: number, b: number}` (required, types WIT dans la description) ; `tools/call` mappe nommé → positionnel et refuse le paramètre manquant — **fin du `number[]`** ; modules core = schéma legacy inchangé, régressions **8/8 + 9/9**.
5. **Conclusion §11 écrite** → `conclusion.md` : réponses aux 8 questions + verdict hypothèse §9 (**confirmée côté technique, nuancée côté écosystème**).
6. **Structure lab** : `AGENTS.md`, `docs-learning/{ROADMAP,LEARNING_STATE,EXPERIMENTS_LOG}.md` (Exp 001→020).
7. **Repo GitHub** : `https://github.com/bolouvipf/houetorwasm.git` — tout poussé (dernier commit de session : docs + conclusion).
8. **Toolchain** : wasmtime 49.0.2 · **wazero 1.12** (Exp 007) · **wit-bindgen 0.62.0** + **wasm-tools 1.261.0** (Exp 018, `~\.local\bin\`) · Rust 1.99.0 (+ wasm32, cible `wasm32-wasip2`) · Node 24.15.0 · Python 3.14 · **clang/LLVM-MinGW 22.1.8** · GPU inutile (tranché) · Wasmer 7.5 = non fonctionnel ici (voir Exp 007).

## À faire ⏳ (suite recommandée, par ordre)

1. **WASI réseau** : sockets (WASI 0.3) ; ~~WIT / composants~~ : **FAIT (Exp 018-019)** — reste `resource`/`variant`/`enum` et la composition d'instances.
2. Client MCP tiers réel « inspector »/Claude Desktop (le filtrage policy est fait — Exp 015 ; le test actuel *est* déjà un client JSON-RPC externe spawn stdio) ; reste l'interconnexion avec un vrai client tiers.
3. **Comparaison avec un cadre existant (Extism)** : même plugin sous Extism (manifeste + PDK) vs HOUETOR — répond à la lacune « aucune comparaison d'écosystème ».
4. Plafond **mémoire** (`-W max-memory-size`) + charge de fichiers WASI réelle ; portabilité macOS/navigateur.
5. ~~Instruments de dépendances (WIT/composants)~~ : **FAIT (Exp 018)**. ~~Chargement distant / signature~~ : **FAIT (Exp 013-016)**. Éventuellement : hôte wasmtime en Rust.

## Point de reprise exact

> Les **4 phases + conclusion sont livrées**, portabilité **✅ multi-OS** (Exp 010), capabilities fichier **✅ lecture+écriture** (Exp 011-012), **distribution ✅ registre/HTTP** (Exp 013), **Component Model ✅ testé** (Exp 018-019), **anti-DoS ✅ fuel/timeout** (Exp 020). Reprendre une **suite** (étape 1 ci-dessus) ou une révision.
> Vérifier l'outillage : `wasmtime --version ; cargo --version ; node --version` (**chemins absolus si shell ancien** : `%USERPROFILE%\.cargo\bin\cargo.exe`, `~\.local\bin\wasmtime-*`, `~\.local\bin\wit-bindgen.exe`, `~\.local\bin\wasm-tools.exe`, wazero = `%TEMP%\opencode\wazero\wazero.exe`) ; WSL : runtimes dans `~/tools` (wasmtime linux + wazero tar.gz).
> Reprendre le fil : `AGENTS.md` §3 → `ROADMAP.md` → `EXPERIMENTS_LOG.md` (dernier : **Exp 020**) → `conclusion.md`.
> Recommandé avant toute reprise : `node prototype\mcp\test_bridge.mjs` (8/8) + `node prototype\mcp\policy_test.mjs` (9/9) + `node prototype\bench\component_test.mjs` (20/20) + `node prototype\bench\fuel_test.mjs` (12/12) + `$env:BENCH_RUNS="9"; node prototype\bench\run_bench.mjs` + `node prototype\bench\portability.mjs` + `powershell -File prototype\bench\portability_os.ps1` + `node prototype\bench\lifecycle.mjs` + `node prototype\bench\wasi_caps.mjs` + `node prototype\bench\wasi_write.mjs` + `node prototype\bench\registry_test.mjs` (15/15) + `node prototype\bench\sig_test.mjs` (12/12) (tout vert).

## Décisions de session

- **2026-10-04** : GPU inutile (travail CPU/RAM) ; accélération = toolchain locale + recherches web.
- **2026-10-04** : logiciel étudié en Phase 3 = **celui que nous créons** (HOUETOR Plugin Host), conformément au document source.
- **2026-10-04** : hôte MVP en **Node** (zéro build) ; wasmtime reste l'arme pour WASI + capabilities réelles.
- **2026-10-04** : source du plugin rangée dans `plugins/<nom>/` (`target/` ignoré par git, `fib_native.exe` ignoré aussi).
- **2026-10-04** : bridge MCP = **client pur du host** (spawn `host.mjs`) — sécurité centralisée dans le host, bridge = couplage de protocole seul.
- **2026-10-04** : pour le bench §8, K différent par jambe mais **`per_call_ns` normalisé** ; `sink`/accumulateur obligatoire (bug dead-code corrigé, Exp 004).
- **2026-10-04 (session 2)** : les plugins « riche » sont des **composants** (`type: "component"`, `wasm32-wasip2`) exécutés par **wasmtime + WAVE** ; les modules core restent en in-process Node (plus rapide, mais non fuel-limable).
- **2026-10-04 (session 2)** : fs = **double verrou** : `HOST_ALLOWED` contient `wasi:filesystem` (déclaratif) + `HOUETOR_PREOPENS` (montages effectifs) — déclarer la permission n'ouvre aucun fichier.
- **2026-10-04 (session 2)** : limites d'exécution **fail-closed** : `HOUETOR_FUEL`/`HOUETOR_TIMEOUT` invalides ou appliquées à un chemin non fuel-limable = **refus**, jamais d'ignorance silencieuse.
- **2026-10-04 (session 2)** : **source de vérité des chiffres** = `phase3_measures.md` + JSON bruts (`results.json`, `fuel_test.json`, …) ; les autres docs ne font que **s'y référer** (éviter les copies qui divergent).

## Reste connu (mineur)

- `prototype/plugins/hello/target/` : build résiduel (ignoré par git) ; idem `prototype/samples/{witcalc,spinhog}/target/` (compilation `wasm32-wasip2`).
- `prototype/samples/{hello-v2,needy}/` : sources servant à `install` (needy : `-C link-arg=--allow-undefined` requis).
- `needy` reste installé (utile pour retester la défense en profondeur ; retirer avec `host.mjs remove needy`) ; `witcalc` aussi (Exp 018, requis par `component_test.mjs`) ; `spinhog` = **retiré** par `fuel_test.mjs` (nettoyage).
- Bruit cosmétique Node/Windows : `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` en stderr lors de certains `die()` pendant une session HTTP (Exp 013-016) — code de sortie et messages d'erreur corrects, tous checks verts ; sans impact fonctionnel.
