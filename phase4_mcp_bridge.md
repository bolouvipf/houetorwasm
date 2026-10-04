# Phase 4 — Pont WASM × MCP (étude §5)

> Date : **2026-10-04** · Implémentation : `prototype/mcp/{bridge.mjs,test_bridge.mjs}` · Test : **8/8 étapes OK** (`transcript.json`).
> Question expérimentale de l'étude §5 : *« Un composant WASM peut-il être transformé automatiquement ou semi-automatiquement en outil MCP ? »*

## 1. Architecture (schéma de l'étude §5 respecté)

```text
                 Plugin WASM (hello@1.0.1, needy@1.0.0 — 160 o)
                       │  manifest.json (exports[], permissions[])
                       ▼
                   WASM Host (host.mjs — deny-by-default, versions)
                       │  sortie JSON de « list » / « run »
                       ▼
                   MCP Bridge (bridge.mjs — stdio, JSON-RPC 2.0, 0 dépendance)
                       │  tools/list générés AUTO depuis les manifestes
                       ▼
                    Agent IA (client MCP générique)
```

**Décision d'architecture** : le bridge est un **client pur du host** (spawn `host.mjs`) — toute la sécurité (manifeste, allow-list, sandbox) reste centralisée dans le host ; le bridge n'ajoute qu'un couplage de protocole.

## 2. Démonstration : manifeste → outils MCP (automatique)

`tools/list` est **généré à la volée** depuis les manifestes découverts par le host. Preuve (sortie réelle du test) :

```text
outils générés automatiquement : ["hello_add","hello_fibonacci","hello_plugin_version","needy_do_log","needy_plugin_version"]
```

Chaque tool porte une description auto-générée avec plugin, version, permissions accordées, et un `inputSchema` JSON (`args: number[]`). **Installation d'un plugin = apparition immédiate de ses outils pour l'agent**, sans reconfiguration du bridge.

## 3. Preuves brutes (test reproductible : `node prototype\mcp\test_bridge.mjs`)

```text
✅ initialize : serverInfo — {"name":"houetor-mcp-bridge","version":"0.1.0"}
✅ tools/list auto : exports de hello → outils MCP
✅ schéma JSON du tool (inputSchema) — {"type":"object","properties":{"args":{...}}}
✅ tools/call hello_add(2, 3.5) → résultat 5.5 via host deny-by-default — result=5.5 plugin=hello@1.0.1
✅ tools/call : pas d'erreur
✅ outil inconnu refusé — outil inconnu : does_not_exist
✅ défense en profondeur : needy_do_log exposé mais REFUSÉ par le host —
   [host] ERREUR : needy : chargement refusé — sandbox deny-by-default :
   imports refusés [env.host_log] (permissions accordées : aucune)
✅ method inconnue → -32601

8/8 étapes OK → transcript.json
```

Transcript complet (requêtes/réponses JSON-RPC brutes) : `prototype/mcp/transcript.json`.

## 4. Réponse à la question expérimentale §5

**OUI — la transformation est automatique**, au niveau du *plumbing* :

| Ce qui est automatique aujourd'hui ✅ | Ce qui reste manuel / limité ⬜ |
|---|---|
| Découverte des plugins + de leurs exports (manifeste validé par le host) | **Typage faible** : seuls `number[]` passent (Canonical ABI / WIT donneraient types, chaînes, structs) |
| Génération du nom d'outil, de la description, du `inputSchema` | **Sémantique** : l'agent voit `hello_add` mais ignore sauf description que c'est l'addition (pas de doc WIT) |
| Publication/rétraction vivante (install/remove → tools/list change) | ~~Granularité : filtrage par policy n'existe pas~~ → **fait (Exp 015)** ; reste : policy dynamique/contextuelle (par agent, par session) |
| Sécurité préservée (le host refuse ce qu'il doit refuser **même si l'outil est exposé**) | **Effets de bord** : fonctions avec état/ressources (WIT `resource`) non gérées |

**Réponse courte** : un plugin WASM avec manifeste **devient un jeu d'outils MCP en une ligne de code** (zéro intégration côté agent) ; ce qui manque pour aller au bout n'est pas MCP mais **WASI/Component Model** (types riches) — exactement la conclusion de la Phase 1 sur le contrat sémantique.

## 5. Découverte notable : défense en profondeur

`needy_do_log` apparaît **bien** dans `tools/list` (le plugin est installé, son manifeste le déclare) mais son appel échoue au host : la permission `env.host_log` n'est pas accordée. **Deux barrières indépendantes** :

1. **Bridge** : n'expose que les exports déclarés (pas d'accès arbitraire au WASM).
2. **Host** : deny-by-default au chargement (imports non listés = refus).

Un agent IA (ou un attaquant qui pilote l'agent) ne peut donc pas « forcer » un plugin plus loin que ce que son manifeste + la policy hôte autorisent. C'est la propriété clé voulue par l'étude §4/§7, démontrée ici **à travers MCP**.

## 5bis. Filtrage d'outils par policy (Exp 015)

**3ᵉ barrière** : le bridge peut restreindre quels outils un agent voit/appelle, via `HOUETOR_MCP_POLICY=<json {"allow":[...], "deny":[...]}>` (`node prototype\mcp\policy_test.mjs` → `policy_test.json`, **9/9**) :

| Verdict | Preuve |
|---|---|
| `tools/list` ne montre que les outils allowés | `["hello_add"]` sur 5 existants |
| allowé → appel OK | `hello_add(2,3.5)=5.5` |
| **deny prime sur allow** | `hello_fibonacci` allowé+denyé → refusé (`policy (deny, …)`) |
| hors allow → refus **avant le host** | message policy, aucune trace `deny-by-default`/`host_log` |
| inconnu ≠ policy | messages distincts (`outil inconnu` vs `refusé par policy`) |
| **fichier policy illisible → fail-closed** | liste vide + tout refusé (un souci de config n'ouvre jamais l'accès) |
| sans variable → rétrocompat | découverte complète (5 outils), test 8/8 inchangé |

Sémantique : allowlist par nom exact d'outil (`<plugin>_<fonction>`) ; deny list **prioritaire** ; sans variable `HOUETOR_MCP_POLICY` → mode « open » (découverte complète, = mode démo, rétrocompat 8/8) ; une policy **demandée mais illisible → fail-closed** (tout refusé).

## 6. Contraste avec l'état de l'art (Phase 2)

- **Extism** expose déjà des plugins en serveurs HTTP ; **Fastly** fait du MCP côté edge — mais nous n'avons trouvé **aucun projet public générant automatiquement `tools/list` MCP depuis des manifestes de plugins WASM** (recherche Phase 2, 2026-10-04). Notre pont est donc une contribution locale originale, même sommaire.
- Phase 2 a montré que **personne n'a standardisé le contrat hôte↔plugin** (8 contrats hétérogènes) : notre pont prouve qu'un **manifeste maison minimal suffit** pour brancher l'IA sur le WASM.

## 7. Suite (non réalisée)

- Chaînage complet avec un **vrai client MCP** (Claude Desktop / npx `@modelcontextprotocol/inspector`) — le bridge parle le protocole standard, testable tel quel.
- Types riches via **WIT/Component Model** (strings, records). ~~Filtrage d'outils par policy~~ → **fait (Exp 015, §5bis)**.
- Ponter vers **wasmtime** (hôte Rust) pour éliminer Node du chemin (mesures RSS).
