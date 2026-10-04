# Phase 2 — Cartographie des systèmes utilisant WASM

> Objectif (étude §6) : répertorier où WASM fonctionne déjà et où son adoption reste limitée.
> Une ligne = une preuve (source + date, vérifiée le **2026-10-04**). Classement par domaine.
> Statut : ✅ rempli (2026-10-04, session 1) — chaque « ? » du squelette a été recherché.

## Légende

- **Type** : Plugin / Extension / Sandboxing / Cloud / Edge / IA / Composant / Embarqué
- **Contrat d'interface** : quel ABI/IDL impose l'hôte au plugin (le cœur de notre question C)
- **Prod ?** : usage en production avéré (oui/non/partiel)
- **Maturité** : ✅ stable · 🟡 partielle/experimentale · 🔴 fragile/abandonné

---

## A. Networking / proxies

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| Envoy (proxy-wasm) | Extension | ABI proxy-wasm 0.2.1 | oui | 🟡 (spec peu maintenue, doc « experimental ») | envoyproxy.io/docs — 2026 |
| Kong (ngx_wasm_module) | Extension | proxy-wasm | partiel | 🟡 | github.com/Kong/ngx_wasm_module |
| **Apache APISIX** | Extension | Proxy Wasm SDK (via wasm-nginx-module) | partiel | 🟡 **gelé « experimental » depuis 2021** | apisix.apache.org/docs/apisix/wasm (« Currently, only a few APIs are implemented ») ; pkg.go.dev/github.com/apache/apisix (« The Wasm or WebAssembly is an **experimental** way ») ; blog APISIX 2.11.0 — 2021-12-01 ; 17k★ — vérifié 2026-10-04 |

**Lecture A** : le contrat proxy-wasm existe depuis 2021 chez Envoy/Kong/APISIX, mais **aucun n'a fini d'implémenter l'ABI** (« only a few APIs are implemented », 5 ans après l'annonce).

## B. Cloud / edge / serverless

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| Cloudflare Workers | Sandboxing/edge | isolates V8 + WASM | oui | ✅ | developers.cloudflare.com — 2026 |
| Fastly Compute | Edge | WASM sandbox | oui | ✅ | docs.fastly.com |
| Fermyon Spin / SpinKube | Serverless | WASI 0.2/0.3 | oui | ✅ (CNCF Sandbox) | — |
| wasmCloud | Composants | WIT (`wasi:keyvalue`…) | oui | ✅ (CNCF Incubating) | github.com/wasmcloud/wasmCloud |
| **Docker Desktop Wasm** | Sandboxing | shims containerd (wasmtime/spin/wasmedge…) | non | 🔴 **ABANDONNÉ** — « Wasm workloads are **deprecated** and will be removed… no longer actively maintained » | docs.docker.com/desktop/features/wasm — vérifié 2026-10-04 |
| containerd/runwasi (K8s) | Sandboxing | CRI/containerd shim (WASI) | partiel | 🟡 **sous-projet non-core**, demos/PoC ; AKS WASI NodePool en « preview » | github.com/containerd/runwasi (« non-core containerd sub-project ») ; thenewstack.io — 2023-07-12 — vérifié 2026-10-04 |
| container2wasm | Compat. conteneurs→Wasm | OCI → Wasm | partiel | 🟡 (CNCF Sandbox 2025-01-21) | cncf.io/projects/container2wasm — 2026-10-02 |

**Lecture B** : les **edge functions** (Cloudflare/Fastly/Spin) sont le vrai succès « serverless » ; côté **conteneurs** (Docker/K8s), l'adoption est soit abandonnée (Docker), soit encore preview (runwasi/AKS).

## C. Bases de données / data

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| **DuckDB-Wasm extensions** | Plugin d'extensions | extension = fichier `.wasm` chargé par **Emscripten dlopen** + **signature crypto** en custom section `duckdb_signature` (vérifiée à chaque LOAD) ; autoload depuis `extensions.duckdb.org` + dépôt communautaire | oui | ✅ (DuckDB 41k★) | duckdb.org/docs/current/clients/wasm/extensions (© 2026 DuckDB Foundation) ; github.com/duckdb/duckdb-wasm — vérifié 2026-10-04 |
| **ClickHouse WASM UDF** | UDF (plugin) | ABI maison `ROW_DIRECT` (2×i32 → i32, sérialisation MessagePack) ; module `wasm32-unknown-unknown` freestanding inséré dans `system.webassembly_modules` + `CREATE FUNCTION … LANGUAGE WASM` ; sandbox mémoire dédiée **dans le processus serveur** | non (ClickHouse Cloud : « Not supported ») | 🟡 **experimental** (`allow_experimental_webassembly_udf`) | clickhouse.com/docs — page wasm_udf datée **2026-08-04** ; crate `clickhouse-wasm-udf` — vérifié 2026-10-04 |
| SQLite (référence négative) | Extensions DB | extensions **natives C (.so/.dll)** — PAS WASM | oui | ✅ (natif) | sqlite.org — contraste documenté dans l'étude Phase 1 |

**Lecture C** : DuckDB donne l'exemple le plus abouti d'un **système de plugins WASM signés** (signature + autoload + vérification) — exactement le périmètre de notre question. ClickHouse prouve que la DB « in-process sandboxed » est faisable mais y va prudent (experimental, pas sur Cloud).

## D. Applications desktop / logiciels grand public

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| Figma (rendu) | Composant interne | JS↔Wasm maison | oui | ✅ | — |
| Photoshop Web / AutoCAD Web | Composant interne | JS↔Wasm | oui | ✅ | — |
| **VS Code (exécution WASM)** | Composant interne / libs | WASI (ext `@vscode/wasm-wasi`) + **Component Model/WIT** (`wit2ts`) ; engine `ms-vscode.wasm-wasi-core` | partiel | 🟡 (Python/Ruby/PHP wasm32-wasi + tree-sitter exécutés **dans** des extensions JS) | code.visualstudio.com/blogs/2023/06/05/vscode-wasm-wasi ; code.visualstudio.com/blogs/2024/05/08/wasm (WIT, composants) — vérifié 2026-10-04 |
| **VS Code (runtime des extensions)** | Extension | **JS, pas WASM** — l'extension host a « the same permissions as VS Code itself » | oui | 🔴 surface d'attaque assumée (CVE-2025-49714 RCE ext. Python, 2025-07-08) ; mitigations = Marketplace signing + sandbox « clean room » + **Workspace Trust** (Restricted Mode par défaut) | code.visualstudio.com/docs/configure/extensions/extension-runtime-security (maj 2026-09-16) ; infoworld.com — 2026-06-29 ; nvd CVE-2025-49714 |
| **Extensions navigateur MV3** (Chrome/Firefox/Safari) | Extension | **Aucun contrat WASM** : JS en service worker + pages « sandbox » (CSP `sandbox`) ; le WASM n'est qu'une source de code autorisée via `'wasm-unsafe-eval'` | oui | ✅ (plateforme JS stable) | developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3 ; MDN `manifest.json/sandbox` + `content_security_policy` (« Don't relax the CSP only to enable WebAssembly ») — vérifié 2026-10-04 |

**Lecture D (réponse forte à la question C)** : les deux plus grands éditeurs d'**extensions** du monde — VS Code et les navigateurs — utilisent WASM comme **bibliothèque à compiler** (tree-sitter, Python…) ou comme simple source de code, **jamais comme runtime de sandbox pour leurs plugins**. Leur confiance repose sur signature + revue de code + trust utilisateur, pas sur WASM.

## E. Frameworks de plugins génériques

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| Extism (Dylibso) | Plugin | manifest + host functions + PDK (15+ langages) | oui | ✅ (~5,8k★) | extism.org — 2026 |
| Shopify Functions | Plugin e-commerce | Shopify Wasm API (NaN-boxing) | oui | ✅ | shopify.dev — 2026 |
| wasmtime embedding | Hôte générique | WASI + host funcs | oui | ✅ | — |

## F. IA / agents

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| MCP servers → WASM | Exécution d'outils | MCP (couche supérieure) | émergent | 🟡 | tendance 2026 — creusé en Phase 4 |
| Fastly MCP on Compute | Edge + MCP | MCP over WASM | partiel | 🟡 | fastly.com — 2026-01-28 |

## G. Embarqué / IoT

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| **WAMR (module Zephyr officiel)** | Runtime embarqué | WASI partiel + API d'accueil `wasm_export.h` | partiel | ✅ module upstream « west », `CONFIG_WAMR=y` : extension/update **sans reflash** + sandbox WASM | docs.zephyrproject.org/latest/develop/manifest/external/wamr.html (doc générée 2026-09-19) — vérifié 2026-10-04 |
| **WAMR (SGX, faible empreinte)** | Runtime embarqué | WASI partiel | oui | ✅ | bytecodealliance |
| **WAMR / wasm3 (domination mesurée)** | Runtimes MCU | — | oui | ✅ benchmark : « **WAMR and Wasm3 are the most widely used** and dominate Wasmi/WARDuino » ; WasmEdge **exclu** des MCU (≥ 4 Go RAM, pas bare-metal) | ACM TACO « Benchmarking WebAssembly for Embedded Systems » — 2025-09-17 |
| **WAMR/wasm3 sur MCU contraints** | Mesures | — | — | 🟡 chiffres : WAMR = **279-480 Ko** de RAM (Pico/ESP32-C6/nRF5340), ~2,8-3 mJ par exécution ; wasm3 = plus léger (~8 Ko RAM min, ~64 Ko binaire) | arXiv:2512.00035 — 2025-12-02 ; wasmruntime.com/wasm3-vs-wamr-2026 — 2026-01-07 (source secondaire) |
| **WAMR (preuve de déploiement)** | — | — | oui | ✅ vulnérabilités avec CVE = code réellement déployé : CVE-2025-58749 (mode LLVM-JIT, memory.fill ≥ 2 Gio) corrigée en 2.4.2 | nvd.nist.gov — 2025-09-16 |

**Lecture G** : l'embarqué est le domaine où WASM est le plus **déploié au quotidien** (mises à jour OTA de firmware sans reflash), avec deux runtimes qui se partagent le marché et des chiffres concrets de RAM.

## H. Échecs / abandons (recherchés délibérément)

| Projet | Type | Raison de l'échec / du blocage | Source + date |
|---|---|---|---|
| **proxy-wasm (gouvernance)** | Extension | 1 mainteneur, spec incomplète (2024) | github.com/envoyproxy/envoy/issues/35420 |
| **Docker Wasm** | Sandboxing conteneurs | **Deprecated** officiellement, plus maintenu, à retirer d'une future version Docker Desktop | docs.docker.com/desktop/features/wasm — vérifié 2026-10-04 |
| **APISIX WASM** | Extension | Annoncé 2021, **toujours « experimental / few APIs implemented »** en 2026 → adopté puis gelé | apisix.apache.org/docs/apisix/wasm ; blog 2.11.0 — 2021-12-01 |
| **PNaCl** (Google, précurseur) | Sandboxing navigateur | API parallèle non web (messages asynchrones) = « obstacles to broader adoption » → remplacé par Wasm dès 2015-2017 | Bytecode Alliance « 10 Years of WebAssembly: A Retrospective » — 2026-01-22 |
| **Retard WASI 0.3** | Spéc | WASI 0.3 annoncée pour **mars 2025**, livrée **2026-06-11** (~15 mois de retard) ; async natif seulement alors | infoworld.com « 4 big changes » — 2025-04-23 ; bytecodealliance.org/articles/WASI-0.3 — 2026-06-11 |
| **Adoption navigateur réelle** | Écosystème | Support technique ~96 % mais **0,35 % des sites desktop / 0,28 % mobile** chargent réellement du WASM (Web Almanac) ; plus gros fichier WASM : 228 Mo | webassembly.org « The States of WebAssembly » — 2026-01-21 (Web Almanac HTTP Archive) |
| **Kotlin/Wasm** | Langage | toujours « **alpha-quality** » (2025) ; threads WASI absents de la roadmap 0.3 | infoworld.com — 2025-04-23 |
| **WasmEdge sur MCU** | Runtime | exclu des benchmarks embarqués : nécessite ≥ 4 Go RAM, pas de bare-metal | ACM TACO — 2025-09-17 |

---

## Synthèse (fin de phase)

- **Où WASM fonctionne déjà (✅)** : **edge functions** (Cloudflare/Fastly/Spin), **rendu applicatif embarqué dans le produit** (Figma/Photoshop), **embarqué/IoT** (WAMR+Zephyr, OTA sans reflash), **runtime de calcul pour langages** (VS Code : Python/tree-sitter en WASM), **sandbox pour calculs serveur** (ClickHouse UDF expérimentales, DuckDB signées).
- **Où l'adoption est limitée (🟡/🔴)** : **systèmes de plugins d'applications** (VS Code et navigateurs refusent WASM comme runtime d'extension), **conteneurs** (Docker abandonné, K8s preview), **proxy/gateways** (proxy-wasm gelé, APISIX « few APIs » depuis 2021), **adoption web réelle** (0,35 % des sites).
- **Contrats d'interface rencontrés (et leur diversité)** — **au moins 8 contrats hétérogènes pour un format censé être universel** : ABI proxy-wasm (0.2.1), ABI ClickHouse ROW_DIRECT/MessagePack, dlopen+signature DuckDB, NaN-boxing Shopify, WIT/Component Model (wasmCloud, VS Code), WASI seul (Spin, WAMR), WASI+host functions (Extism/wasmtime), JS↔Wasm maisons (Figma). **La question C de l'étude est confirmée empiriquement : le binaire est universel, le contrat ne l'est pas.**
- **Conséquence pour notre question C (standardisation)** : la standardisation a réussi **sous** le binaire (Wasm core) et est en cours **au-dessus** (WASI/Component Model : 0.2 en 2024, 0.3 en 2026-06, 1.0 attendu fin 2026/début 2027 — BA « Road to Component Model 1.0 », 2026-06-08), mais **aucun éditeur majeur de plugins (VS Code, Chrome, Firefox) n'attend ces specs** : ils utilisent JS + signature + confiance. Notre prototype HOUETOR (manifeste + deny-by-default + versions) se place donc précisément dans cet interstice : un contrat maison léger, là où personne n'a proposé d' standard de facto.
