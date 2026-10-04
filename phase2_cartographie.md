# Phase 2 — Cartographie des systèmes utilisant WASM

> Objectif (étude §6) : répertorier où WASM fonctionne déjà et où son adoption reste limitée.
> Remplir **une ligne = une preuve** (source + date). Classement par domaine.
> Statut : 🔄 squelette créé 2026-10-04 — **à remplir**.

## Légende

- **Type** : Plugin / Extension / Sandboxing / Cloud / Edge / IA / Composant / Embarqué
- **Contrat d'interface** : quel ABI/IDL impose l'hôte au plugin (le cœur de notre question C)
- **Prod ?** : usage en production avéré (oui/non/partiel)
- **Maturité** : ✅ stable · 🟡 partielle · 🔴 fragile/abandonné

---

## A. Networking / proxies

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| Envoy (proxy-wasm) | Extension | ABI proxy-wasm 0.2.1 | oui | 🟡 (spec peu maintenue, doc « experimental ») | envoyproxy.io/docs — 2026 |
| Kong (ngx_wasm_module) | Extension | proxy-wasm | partiel | 🟡 | github.com/Kong/ngx_wasm_module |
| APISIX / autres | Extension | à vérifier | ? | ? | à rechercher |

## B. Cloud / edge / serverless

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| Cloudflare Workers | Sandboxing/edge | isolates V8 + WASM | oui | ✅ | developers.cloudflare.com — 2026 |
| Fastly Compute | Edge | WASM sandbox | oui | ✅ | docs.fastly.com |
| Fermyon Spin / SpinKube | Serverless | WASI 0.2/0.3 | oui | ✅ (CNCF Sandbox) | — |
| wasmCloud | Composants | WIT (`wasi:keyvalue`…) | oui | ✅ (CNCF Incubating) | github.com/wasmcloud/wasmCloud |
| Docker Wasm / K8s | Sandboxing | WASI | partiel | 🟡 | à vérifier |

## C. Bases de données / data

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| à rechercher (ex. extensions SQL, pipelines) | ? | ? | ? | ? | Phase 2 |

## D. Applications desktop / logiciels grand public

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| Figma (rendu) | Composant interne | JS↔Wasm maison | oui | ✅ | — |
| Photoshop Web / AutoCAD Web | Composant interne | JS↔Wasm | oui | ✅ | — |
| Extensions de navigateur / VS Code / Obsidian / Figma plugins | Extension | **non-WASM ?** (à vérifier) | ? | ? | → question C |

## E. Frameworks de plugins génériques

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| Extism (Dylibso) | Plugin | manifest + host functions + PDK (15+ langages) | oui | ✅ (~5,8k★) | extism.org — 2026 |
| Shopify Functions | Plugin e-commerce | Shopify Wasm API (NaN-boxing) | oui | ✅ | shopify.dev — 2026 |
| wasmtime embedding | Hôte générique | WASI + host funcs | oui | ✅ | — |

## F. IA / agents

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| MCP servers → WASM | Exécution d'outils | MCP (couche supérieure) | émergent | 🟡 | tendance 2026 — à creuser Phase 4 |
| Fastly MCP on Compute | Edge + MCP | MCP over WASM | partiel | 🟡 | fastly.com — 2026-01-28 |

## G. Embarqué / IoT

| Projet | Type | Contrat d'interface | Prod ? | Maturité | Source + date |
|---|---|---|---|---|---|
| WAMR (SGX, faible empreinte) | Runtime embarqué | WASI partiel | oui | ✅ | bytecodealliance |
| à compléter | ? | ? | ? | ? | Phase 2 |

## H. Échecs / abandons (à rechercher délibérément)

| Projet | Type | Raison de l'échec | Source + date |
|---|---|---|---|
| proxy-wasm spec (gouvernance) | Extension | 1 mainteneur, spec incomplète (2024) | github.com/envoyproxy/envoy/issues/35420 |
| à compléter | ? | ? | Phase 2 |

---

## Synthèse intermédiaire (à remplir en fin de phase)

- **Où WASM fonctionne déjà** :
- **Où l'adoption est limitée** :
- **Contrats d'interface rencontrés (et leur diversité)** :
- **Conséquence pour notre question C (standardisation)** :
