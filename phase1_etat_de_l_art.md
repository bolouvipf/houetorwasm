# Phase 1 — État de l'art

## Étude et prototypage d'une architecture universelle de plugins basée sur WebAssembly

**Date :** 4 octobre 2026
**Objet :** Comprendre précisément les technologies existantes (WASM → WASI → Component Model → WIT → Runtimes → Plugins) et leur niveau de maturité.
**Question à laquelle cette phase doit répondre :**

> La technologie possède-t-elle réellement les propriétés nécessaires à un système universel de plugins ?

---

## 0. Chaîne technologique étudiée

```text
WASM Core          format binaire, sandbox mémoire, validation
   ↓
WASI               accès système par capabilities (fs, net, clocks, random)
   ↓
Component Model    types riches, composants, lien/découplage, isolation
   ↓
WIT                langage de description d'interfaces (.wit)
   ↓
Runtimes           Wasmtime, WasmEdge, wazero, Wasmer, WAMR, V8...
   ↓
Plugins            Extism, proxy-wasm/Envoy, Shopify Functions, wasmCloud...
```

Chaque étage est évalué selon : **statut de standardisation**, **état d'implémentation**, **usage en production**, **lacunes résiduelles**.

---

## 1. WASM Core — le format d'exécution

### 1.1 Statut de standardisation

| Étape | Statut |
|---|---|
| Wasm 1.0 | W3C Recommendation (5 décembre 2019) |
| Wasm 2.0 | W3C Candidate Recommendation Draft (16 juin 2025) |
| Wasm 3.0 | Standard W3C (septembre 2025, selon The New Stack ; spec publiée sur webassembly.org/specs) |

Wasm 3.0 a standardisé un ensemble de fonctionnalités de production : **WasmGC**, **exception handling**, **tail calls**, **multi-memory**, **memory64**, **SIMD 128 bits**. WasmGC permet à Java, Kotlin, Dart, Scala de réutiliser le GC du moteur au lieu de embarquer leur propre collecteur.

### 1.2 Implantation navigateur (maturité élevée)

- Support WebAssembly : **~96 % des navigateurs** (caniuse, données StatCounter juillet 2026).
- Utilisation mesurée : **~5,5 % des pages Chrome** chargent du WASM début 2026 (contre 4,5 % l'année précédente) — Chrome Platform Status via *State of WebAssembly 2026*.
- Quelques cas lourds en production : Figma (moteur de rendu), Adobe Photoshop Web, AutoCAD Web, Google Meet (traitement vidéo), Office Online, BBC iPlayer, American Express (paiements).

### 1.3 Modèle de sécurité

Propriétés structurelles, indépendantes du runtime :

- **Pas d'accès mémoire direct** : mémoire linéaire bornée, aucun pointeur hôte accessible.
- **Pas d'appel système possible** : le module n'appelle que des imports explicitement fournis à l'instanciation.
- **Validation statique** avant exécution (type safety, contrôle de flot, pas d'extensions de flot illégales).
- **Isolation par défaut** : le sandbox est la situation par défaut, chaque capacité est *opt-in* — contrairement à une bibliothèque partagée native chargée dans le processus.

Preuve formelle disponible dans la littérature : **vWasm** et **rWasm** (USENIX Security 2022, Bosamiya/Lim/Parno) démontrent un sandboxing « provably safe » avec un surcoût compétitif face aux compilateurs non vérifiés.

### 1.4 Limite fondamentale pour les plugins

Le type system de Wasm Core est volontairement minimal : un module n'échange que des **entiers, flottants et adresses mémoire**. Toute donnée structurée (chaînes, listes, objets) doit être sérialisée manuellement dans la mémoire linéaire.

```text
Module A (Rust) ──?──▶ Module B (Python)
       mémoire linéaire partagée / convention ABI maison
       → chaque équipe réinvente le protocole, souvent incorrectement
```

**C'est précisément le problème que le Component Model (§3) est censé résoudre.**

### 1.5 Verdict maturité : **STABLE / STANDARDISÉ**

---

## 2. WASI — l'interface système

### 2.1 Chronologie des versions

| Version | Nom | Statut | Date / contenu |
|---|---|---|---|
| WASI 0.1 | Preview 1 | Legacy, largement utilisé | API type POSIX, IDL `witx` |
| **WASI 0.2** | Preview 2 | **Stable**, remplacée par 0.3 mais toujours supportée | Vote du WASI Subgroup le **25 janvier 2024** ; bascule complète sur le Component Model + WIT |
| **WASI 0.3** | Preview 3 | **Stable, courante** | Publié le **11 juin 2026** ; `async func`, `stream<T>`, `future<T>` comme primitives natives ; le paquet `wasi:io` est supprimé |
| WASI 0.3.1 | — | En cours | Vote du 6 août 2026 : type `map<K,V>`, annotations `implements` |
| WASI 1.0 | — | À venir | Dépend du passage du Component Model à la 1.0 |

Interfaces stables de WASI 0.2 : `wasi:cli`, `wasi:filesystem`, `wasi:sockets`, `wasi:clocks`, `wasi:random`, `wasi:http`, `wasi:io`.

**Deux « mondes » (worlds) de référence :**
- `wasi:cli/command` → programmes CLI (fichiers, env, stdin/stdout).
- `wasi:http/proxy` → serveurs/proxies HTTP.

### 2.2 Modèle de sécurité par capabilities (point central de l'étude)

D'après `wasi.dev/security` et `WASI/docs/DesignPrinciples.md` :

- **Pas d'autorité ambiante** : un composant démarre avec *aucun* accès au monde extérieur.
- **Deny-by-default** : pas de handle de capacité par défaut.
- **Handles infalsifiables** : impossible de fabriquer un handle à partir d'un entier arbitraire ; seule la transmission explicite par un autre détenteur crée un accès.
- **La surface de capacité est inspectable statiquement** dans le binaire du composant (imports WIT).
- **Garanties indépendantes du processus hôte** : un composant sans import `filesystem` ne peut pas lire de fichiers, *quelle que soit* la puissance du processus hôte. C'est plus fort que l'isolation de processus classique au niveau OS.

Conséquence directe pour un host de plugins : **la permission est exprimée dans le contrat d'interface, pas dans une configuration hôte ad hoc**.

### 2.3 Points de vigilance

1. **La sécurité dépend de l'implémentation du runtime.** Exemple documenté : le module WASI de Node.js est explicite — *« do not rely on it to run untrusted code »*, son sandboxing fichier « peut être contourné par diverses techniques ». La *spécification* est solide ; chaque hôte doit être audité séparément.
2. **Interopérabilité prouvée par les tests** : les implémentations conformes WASI 0.2 passant la suite de tests de Wasmtime sont aujourd'hui **Wasmtime** et **jco** (transpileur JS).
3. **Rupture historique** : 0.1 → 0.2 a été une migration coûteuse (le « component » Preview 1 était en fait un core module). 0.2 → 0.3 est plus douce grâce à la virtualisabilité (polyfill possible).

### 2.4 Verdict maturité : **STABLE (0.2 et 0.3), API encore en évolution rapide vers 1.0**

---

## 3. Component Model — le mécanisme de composition

### 3.1 Ce qu'il apporte

Le Component Model est la couche au-dessus du core Wasm qui définit :

- le **système de types** (types riches : chaînes, listes, variantes, ressources avec handles) ;
- le **format binaire** des composants ;
- l'**IDL** (WIT) ;
- les **conventions d'appel** (Canonical ABI) pour passer des valeurs typées au travers de la frontière d'isolation ;
- le **liage/découplage** (shared-nothing et shared-everything linking).

Résultat recherché : des composants écrits en **Rust, Go, JS, Python, C/C++** peuvent s'appeler sans code collant, sans taxe de sérialisation réimplémentée par équipe.

### 3.2 Statut (2026)

- **En production** : « Both WASI and the Component Model are already heavily used in production » — Bytecode Alliance, *The Road to Component Model 1.0* (8 juin 2026).
- **Objectif 1.0** : trajectoire annoncée par Luke Wagner et Alex Crichton (Plumbers Summit février 2026, Wasm I/O mars 2026). WASI 1.0 suivra et dépendra de la 1.0 du Component Model.
- **Intérêt des navigateurs** : Mozilla (travail de Ryan Hunt, résultats de performance présentés au WebAssembly CG) et Chrome étudient une implémentation **native** du Component Model — car il ne fournit que des primitives de calcul, pas d'I/O.
- **Éditeur de référence** : le livre *The WebAssembly Component Model* (Bytecode Alliance).

### 3.3 Lacunes documentées

| Lacune | Détail |
|---|---|
| **Parité des langages** | Rust est de premier ordre (`cargo-component`, `wit-bindgen`) ; Go via **TinyGo** (pas le compilateur standard) ; Python/Ruby en mûrissement ; **Java sans target officiel** début 2026 ; JavaScript via `jco` (transpilation) |
| **Instanciation à runtime** | Fonctionnalité recherchée pour la 1.0 (chargement paresseux, sous-commandes, durées de vie distinctes) |
| **Versioning des interfaces WIT** | L'outillage de gestion des versions WIT à travers un registre est *en cours de maturité* ; pas encore hérité de l'écosystème comme dans npm/cargo |
| **Cible navigateur** | « Not yet ready as a browser target » (état début 2026) — le Component Model reste avant tout côté WASI |
| **Parcours développeur inégal** | « Everything works, but not everything works with the same smoothness » |

### 3.4 Verdict maturité : **PRODUCTION-READY côté serveur/edge en Rust ; en cours de stabilisation (1.0) ; inégal hors Rust**

---

## 4. WIT — le contrat d'interface

### 4.1 Rôle

WIT (*WebAssembly Interface Types*) est le langage de description d'interfaces du Component Model : il décrit ce qu'un composant **importe** (ce dont il a besoin) et ce qu'il **exporte** (ce qu'il offre).

```wit
package example:facturation@1.0.0;

interface invoices {
  record invoice { id: string, total: f64 }
  create-invoice: func(client: string, amount: f64) -> invoice;
  calculate-total: func(items: list<u32>) -> f64;
}

world plugin {
  export invoices;
  import wasi:logging/logging;
}
```

Le générateur de bindings (`wit-bindgen`, `cargo-component`, `jco`, etc.) produit le code hôte et invité ; le Canonical ABI gère la conversion des types.

### 4.2 Mécanismes de versioning disponibles

- Paquets nommés avec version sémantique : `wasi:http@0.2.1`.
- Annotations `@since` / `@unstable` / `@deprecated` (portes de fonctionnalités) — depuis WASI 0.2.1.
- Adoption cumulative des fonctionnalités du Component Model par vote du WASI Subgroup (ex. `map<K,V>` adopté le 6 août 2026).

### 4.3 Ce que WIT résout — et ce qu'il ne résout pas

| Résolu par WIT | **Non** résolu par WIT |
|---|---|
| Syntaxe et types de l'échange de données | **Sémantique applicative** : `create_invoice` ne veut rien dire tant qu'aucun standard sectoriel ne l'a défini |
| Découplage hôte/invité | **Découverte** : où trouve-t-on le composant ? |
| Dérivation automatique des bindings | **Confiance** : qui a signé, quelle provenance ? |
| Inspection statique des capabilities | **Politique de permissions par application** (autoriser lire-mais-pas-écrire ?) |

**WIT est la mécanique de contrat, pas le standard de contrat.** C'est exactement le « problème de standardisation » identifié dans la question C de l'étude.

### 4.4 Verdict maturité : **STABLE mécaniquement, standardisation sémantique inexistante**

---

## 5. Runtimes

### 5.1 Tableau comparatif

| Runtime | Langage | Licence | Positionnement | Support Component Model / WASI 0.2-0.3 |
|---|---|---|---|---|
| **Wasmtime** | Rust | Apache-2.0 | Référence de conformité, serveur, sécurité | ✅ Complet (référence, suite de tests WASI) |
| **Wasmer** | Rust | MIT | Usage universel, registre `wasmer.io`, WASIX | ✅ |
| **WasmEdge** | C++ | Apache-2.0 | Edge, inference IA (TF/PyTorch), Kubernetes | ✅ |
| **wazero** | Go (pur, zéro CGO) | Apache-2.0 | Intégration Go, backend d'Extism | WASI 0.1 principalement |
| **WAMR** | C | Apache-2.0 | IoT/embarqué, faible empreinte, SGX | Partiel (utilisé par Envoy) |
| **V8 / SpiderMonkey** | — | — | Navigateurs, isolates, Envoy | ❌ core Wasm uniquement |
| **Wasm3** | C | — | Interpréteur, démarrage minimal | ❌ |

### 5.2 Performances (indicateurs, pas vérité absolue)

Benchmark wasmRuntime.com (15 janvier 2026, Ubuntu 24.04, 8 vCPU, Rust 1.80, médianes) :

| Runtime | Démarrage à froid | Exécution | Total |
|---|---|---|---|
| Wasmtime | 5,2 ms | 10,4 ms | 15,6 ms |
| Wasmer | 6,8 ms | 12,1 ms | 18,9 ms |
| Wazero | 4,5 ms | 18,7 ms | 23,2 ms |
| WasmEdge | 8,1 ms | 15,3 ms | 23,4 ms |
| Wasm3 | 2,1 ms | 45,2 ms | 47,3 ms |

Repères externes (diagnostic *WebAssembly in 2026*, avril 2026) :
- Démarrage à froid natif : **< 1 ms** vs 100 ms–3 s pour Docker (hors hybride Docker+Wasm, plus lent — étude ACM).
- Exécution CPU : **~1,1–1,3×** plus lent que du natif.
- Empreinte : **< 1 MB au repos**, images 85 % plus petites ; densité 15–20× plus d'instances par hôte.
- I/O réseau : **en retard** sur un conteneur (stack WASI networking encore jeune).

### 5.3 Support Wasmtime / LTS

Wasmtime a dépassé la version 30 et propose des fenêtres de maintenance **LTS de 2 ans** (Bytecode Alliance) — signal de maturité opérationnelle pour un host de plugins.

### 5.4 Verdict maturité : **MATURE pour l'exécution ; Wasmtime = référence**

---

## 6. Ce qui existe déjà comme systèmes de plugins WASM

> Synthèse rapide ici ; **cartographie détaillée réservée à la Phase 2**.

| Système | Domaine | Nature du contrat d'interface |
|---|---|---|
| **Extism** (Dylibso) | Framework de plugins générique, ~5,8k★ | Contrat maison : manifeste + host functions + PDK dans 15+ langages ; allowed paths/HTTP ; limites (fuel, timers) |
| **proxy-wasm / Envoy** | Proxy réseau, filtres L4/HTTP | ABI `proxy-wasm` 0.2.1 ; **statut spec fragile** (repo peu maintenu, avis « experimental » dans la doc Envoy) |
| **Shopify Functions** | Logique checkout e-commerce | API WASI-maison (NaN-boxing) publiée en open source (2025) ; Rust/JS/Zig/TinyGo |
| **wasmCloud** (CNCF Incubating) | Plateforme cloud-native de composants | Interfaces WIT publiques (`wasi:keyvalue`, `wasi:blobstore`…) ; modèle deny-by-default |
| **Cloudflare Workers / Fastly Compute** | Edge serverless | Runtime isolates + WASM ; 2M+ développeurs Cloudflare ; Fastly expose MCP depuis Compute |
| **Spin / SpinKube (CNCF Sandbox)** | Serverless Wasm sur Kubernetes | WASI 0.2/0.3, démarrage sub-ms |
| **Navigateurs** (Figma, Photoshop Web…) | Applications web | Contrat JS ↔ Wasm (Web API) |

**Observation clé :** aucun de ces systèmes n'utilise le même contrat d'interface. Chacun a redéfini *son* ABI (Extism manifest, proxy-wasm ABI, Shopify Wasm API, WIT worlds wasmCloud). **WASM fournit l'exécution ; le contrat reste local à chaque logiciel.** C'est la confirmation empirique de la question C de l'étude.

---

## 7. Synthèse : matrice de maturité

| Étage | Statut 2026 | Niveau | Commentaire |
|---|---|---|---|
| WASM Core | W3C (1.0/2.0/3.0) | ⬛⬛⬛⬛⬛ Stable | Adopté massivement côté navigateur |
| Sandbox / sécurité mémoire | Preuves formelles disponibles | ⬛⬛⬛⬛⬛ Stable | Propriété la plus solide |
| WASI 0.2 | Stable depuis 01/2024 | ⬛⬛⬛⬛⬜ Stable | « Island of stability » (rustc) |
| WASI 0.3 (async) | Stable depuis 06/2026 | ⬛⬛⬛⬛◻ En déploiement | Recommandé pour les nouveaux projets |
| Component Model | En route vers 1.0 | ⬛⬛⬛⬛◻ Prod. (Rust) | Inégal hors Rust ; pas encore cible navigateur |
| WIT | Stable (mécanique) | ⬛⬛⬛⬛◻ Stable | Manque le standard sémantique |
| Runtimes | Multiple, interopérable | ⬛⬛⬛⬛⬛ Mature | Wasmtime = référence |
| Distribution / registres | Fragmenté | ⬛⬛◻◻◻ Fragmenté | `wkg`/OCI, Warg, registre Wasmer… pas d'unique |
| Découverte / marketplace | Émergente | ⬛⬛◻◻◻ Émergente | Aucun équivalent npm universel |
| Versioning d'interfaces | Partiel | ⬛⬛◻◻◻ En maturité | `@since`, mais outillage pauvre |
| Débogage / observabilité | Faible | ⬛⬛◻◻◻ Limite | Point de douleur majeur |
| Parité des langages | Inégale | ⬛⬛⬛◻◻ Partiel | Rust >> Go(TinyGo)/JS/Python > Java |
| Threads côté WASI | Absent | ⬛◻◻◻◻ Manquant | Pas de date de livraison début 2026 |

---

## 8. Réponse à la question de la Phase 1

> **La technologie possède-t-elle réellement les propriétés nécessaires à un système universel de plugins ?**

### 8.1 Ce qu'elle possède déjà (réponse : **oui**)

1. **Isolation forte et par défaut** — sandbox mémoire bornée, pas d'appel système sans import, validateur statique, preuves formelles publiées. *Supérieure au chargement d'une bibliothèque native ou d'un script à autorité ambiante.*
2. **Portabilité réelle** — un binaire `.wasm` (voire un composant) tourne sur navigateur, serveur, edge, embarqué, sans recompilation cible.
3. **Performance suffisante** — ~1,1–1,3× vs natif, démarrage sub-ms, empreinte mémoire très faible, densité multi-tenant élevée.
4. **Permissions granulaires, déclaratives et inspectables** — capabilities WASI/WIT, deny-by-default, surfaces lisibles dans le binaire.
5. **Inter-langages** — le Component Model + WIT l'apporte mécaniquement (Rust, C/C++, Go/TinyGo, JS, Python…).
6. **Exécution prouvée en production** — Shopify, Envoy, wasmCloud, Cloudflare, Fastly, Figma…

### 8.2 Ce qui manque encore (réponse : **partiellement**)

1. **Le contrat sémantique n'est pas standardisé** — WIT décrit *comment* échanger, pas *quoi* échanger. Chaque logiciel continue de définir son propre système de plugins (question C de l'étude : un plugin VS Code ≠ plugin WordPress).
2. **Aucun standard de découverte/distribution universel** — `wkg`/OCI, Warg, registre Wasmer, marketplaces maison : fragmentation similaire à celle des runtimes avant npm.
3. **Expérience développeur inégale** — Rust exceptionnellement bien servi ; debug difficile ; outillage hors Rust dispersé.
4. **Stabilité perçue du contrat** — transitions 0.1→0.2→0.3 ont érodé la confiance (« spec churn »), même si 0.2 reste une « island of stability ».
5. **Limites fonctionnelles** — pas de threads côté WASI ; I/O réseau en retard ; pas encore de cible navigateur pour le Component Model.
6. **La sécurité dépend du runtime** — la spécification est bonne, mais un hôte mal implémenté (cas Node.js WASI) ruine la garantie. Auditer le runtime fait partie du modèle de confiance.

### 8.3 Conclusion intermédiaire

**WASM possède aujourd'hui les propriétés *mécaniques* d'une infrastructure universelle de plugins (exécution, isolation, portabilité, permissions), mais pas encore les propriétés *écosystémiques* (contrat d'interface commun, découverte, distribution, confiance).** L'écart n'est plus technique côté exécution ; il est resté du côté des **interfaces, de la distribution et de la découverte** — ce qui constitue exactement le cœur de l'hypothèse de recherche (§9 de l'étude) et le terrain du prototype (Phase 3).

---

## 9. Pistes à explorer ensuite

- **Phase 2 (Cartographie)** : confirmer/étendre la table §6 ; catégoriser par domaine (networking, cloud/edge, bases de données, desktop, serverless, embarqué, IA) ; recenser les *échecs* autant que les succès.
- **Phase 3 (Prototype)** : mesurer concrètement les critères §7 de l'étude (chargement, invocation, permissions, mise à jour, retrait) avec Wasmtime comme hôte de référence ; comparer aux plugins natif/Python/JS.
- **Question ouverte** : quelle forme donner au manifeste d'un plugin universel (nom, version, WIT world, permissions, provenance/signature) ?

---

## 10. Sources

**Spécifications & standards**
- WebAssembly — Specifications (Wasm 1.0/2.0/3.0) : https://webassembly.org/specs/index.html
- WebAssembly — Feature Status : https://webassembly.org/features
- WebAssembly GitHub — WASI : https://github.com/WebAssembly/WASI
- WASI.dev — Releases (0.1 / 0.2 / 0.3) : https://wasi.dev/releases
- WASI.dev — WASI 0.2 : https://wasi.dev/releases/wasi-p2
- WASI.dev — **Security (capability-based)** : https://wasi.dev/security
- WASI Design Principles : https://github.com/WebAssembly/WASI/blob/main/docs/DesignPrinciples.md
- Component Model repo : https://github.com/WebAssembly/component-model
- Component Model FAQ : https://component-model.bytecodealliance.org/reference/faq.html

**Analyses & trajectoire**
- Bytecode Alliance — *The Road to Component Model 1.0* (8 juin 2026) : https://bytecodealliance.org/articles/the-road-to-component-model-1-0
- Bytecode Alliance — *WASI 0.2 Launched* (25 janv. 2024) : http://bytecodealliance.org/articles/WASI-0.2
- *WebAssembly in 2026: Three Years of "Almost Ready"* (avril 2026) : https://www.javacodegeeks.com/2026/04/webassembly-in-2026-three-years-of-almost-ready.html
- *State of WebAssembly 2026* (adoption Chrome) : https://devnewsletter.com/p/state-of-webassembly-2026/
- The New Stack — *Wasm 3.0* (spécification) : https://thenewstack.io/wasm-3-0-no-component-model-and-no-docker-moment/
- RedMonk — *Wasm's Identity Crisis* (oct. 2025) : https://redmonk.com/kholterhoff/2025/10/17/wasms-identity-crisis/
- Bosamiya, Lim, Parno — *Provably-Safe Multilingual Software Sandboxing using WebAssembly*, USENIX Security 2022 : https://www.usenix.org/conference/usenixsecurity22/presentation/bosamiya
- InfoQ — *How WebAssembly Components Enable Safe and Portable Software Extensions* (févr. 2026)

**Runtimes**
- Benchmarks runtimes (15 janv. 2026) : https://wasmruntime.com/en/benchmarks
- Matrice de comparaison 2026 : https://github.com/wasmruntime-io/wasm-runtime-comparison
- Wasmtime : https://wasmtime.dev
- Wasmer Registry : https://docs.wasmer.io/registry

**Systèmes de plugins étudiés**
- Extism : https://extism.org/ — repo : https://github.com/extism/extism
- Envoy — Wasm : https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/advanced/wasm
- proxy-wasm spec : https://github.com/proxy-wasm/spec
- Shopify — WebAssembly for Functions : https://shopify.dev/docs/apps/build/functions/programming-languages/webassembly-for-functions
- wasmCloud : https://github.com/wasmcloud/wasmcloud
- Cloudflare Workers — WebAssembly : https://developers.cloudflare.com/workers/runtime-apis/webassembly
- Fastly Compute : https://docs.fastly.com/products/product-compute

**Distribution**
- wasm-pkg-tools / `wkg` (OCI) : https://github.com/bytecodealliance/wasm-pkg-tools
- Warg (WebAssembly Registry) : https://github.com/bytecodealliance/registry
- Distributing Wasm components using OCI registries (Microsoft, 2024) : https://opensource.microsoft.com/blog/2024/09/25/distributing-webassembly-components-using-oci-registries

**Sécurité — avertissement d'implémentation**
- Node.js WASI (avertissement sandboxing) : https://github.com/nodejs/node/blob/main/doc/api/wasi.md
