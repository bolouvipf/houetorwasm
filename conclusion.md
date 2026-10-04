# Conclusion — Réponses aux questions finales (étude §11)

> Date : **2026-10-04** · Base de preuves : `phase1_etat_de_l_art.md` · `phase2_cartographie.md` · `phase3_measures.md` · `phase4_mcp_bridge.md` · `docs-learning/EXPERIMENTS_LOG.md` (Exp 001→006).
> Rappel de la règle du lab : **aucune réponse sans preuve brute datée** ; les chiffres renvoient aux fichiers de mesures.

## Verdict sur l'hypothèse (§9)

> *« WASM + WASI + Component Model pourraient constituer une infrastructure commune de plugins, à condition de résoudre interfaces, permissions, découverte, distribution et compatibilité. »*

**CONFIRMÉE POUR LA PARTIE TECHNIQUE, NUANCÉE POUR LA PARTIE ÉCOSYSTÉMIQUE.**

- ✅ **Technique** : notre hôte (250 lignes, 0 dépendance) fait tout le cycle de vie §4, avec sandbox deny-by-default, mesures au 1/10 000ᵉ de µs, et exécution à **1,5× du natif** sous wasmtime (Exp 006).
- ⚠️ **Écosystémique** : aucun des 5 problèmes listés n'est résolu *par WASM lui-même* — nous les avons contournés avec un manifeste maison (interfaces/permissions/découverte) et ils restent ouverts à l'échelle du marché (distribution, compatibilité : Phase 2 montre **8 contrats hétérogènes** et des éditeurs majeurs qui n'utilisent pas WASM pour leurs plugins).
- **Ce qu'il manque n'est pas du runtime mais du standard sémantique** → exactement le rôle assigné au Component Model/WASI (0.2 en 2024, 0.3 le 2026-06-11, 1.0 attendu fin 2026/début 2027).

---

## 1. Que permet réellement WASM aujourd'hui ?

**Exécuter du code non fiable, presque au natif, partout, avec une sandbox par défaut.** Preuves :
- **17,8 ns** natif vs **27,2 ns** sous wasmtime vs **59,9 ns** via hôte Node (Exp 006) ;
- plugin **160 o**, mémoire linéaire **1 Mo**, chargement **~2 ms** (Exp 004) ;
- adoption réelle : edge (Cloudflare/Fastly), Figma, embarqué WAMR/Zephyr, VS Code (Python/tree-sitter) — Phase 2 ;
- limites : adoption web mesurée **0,35 % des sites** (Web Almanac 2025), threads absents de WASI 0.3, async livré seulement en 2026-06.

## 2. Quel est le niveau de maturité de WASI et du Component Model ?

**WASI : 0.2 stable (2024-01) → 0.3 stable (2026-06-11, async natif) mais ~15 mois de retard sur le planning** ; **Component Model : en route vers 1.0** (BA « Road to 1.0 », 2026-06-08), WIT comme IDL. Source : Phase 1 §sources, Exp 001.
→ Maturité 🟡 en pleine accélération : utilisable aujourd'hui (wasmCloud, Spin le prouvent en prod), mais le contrat riche (types, ressources, async) n'est pas encore *partout* — d'où notre typage `number[]` limitant le bridge Phase 4.

## 3. Quels systèmes utilisent déjà WASM comme infrastructure de plugins ?

**Phase 2 (8 domaines, sources datées)** : proxy-wasm (Envoy/Kong/APISIX, ABI figée depuis 2021), **DuckDB (extensions WASM signées + autoload)**, **ClickHouse (UDF sandboxed in-process)**, Shopify Functions, Extism, wasmCloud (WIT), Spin, WAMR+Zephyr (OTA sans reflash), VS Code (WASI/Component Model pour libs). Inversement : **VS Code et les navigateurs n'utilisent PAS WASM comme runtime d'extension** (JS + signature + confiance).

## 4. Quels problèmes empêchent encore une véritable universalité ?

Liste établie par preuves (Phase 1 §8 + Phase 2 synthèse) :
1. **Contrat sémantique fragmenté** : ≥ 8 ABI/IDL hétérogènes (proxy-wasm, ROW_DIRECT, dlopen signé, NaN-boxing, WIT, WASI, host functions…).
2. **Découverte/distribution** : aucun registre/manifeste standard (nous en avons inventé un en 40 lignes — preuve que le standard manque).
3. **Permissions** : WASI = capabilities système, mais *pas* le modèle « plugin demande, hôte accorde » au niveau applicatif (notre `HOST_ALLOWED` est maison).
4. **Maturité WASI/CM** : async livré 2026-06, threads absents, 1.0 pas encore là.
5. **Adoption réelle** : 0,35 % des sites ; Docker Wasm abandonné 🔴 ; APISIX WASM gelé 🟡 ; runwasi encore non-core.
6. **Éditeurs de plugins qui contournent WASM** (Chrome, VS Code) : le standard n'impose rien à personne.

## 5. Peut-on construire un host de plugins WASM générique ?

**OUI — démontré.** `prototype/host/host.mjs` : ~250 lignes, **0 dépendance**, découvre, valide le manifeste, charge en **deny-by-default**, accorde des permissions, appelle, retire, archive les versions, refuse les doublons — **8/8 étapes du §4 prouvées** (Exp 003). Le même host charge n'importe quel `wasm32-unknown-unknown` respectant le manifeste (le plugin `needy` hostile l'a appris à ses dépens).

## 6. Quels sont ses avantages et ses limites face aux plugins traditionnels ?

| Axe (mesuré) | Natif | Python | JS | **WASM** | Verdict |
|---|---:|---:|---:|---:|---|
| Exécution (ns/appel) | **17,8** | 4 127,6 | 80,5 | **27,2** (wasmtime) | WASM ≈ natif ×1,5 |
| Artefact | 88 064 o | 1 735 o | 991 o | **160 o** | WASM vainqueur |
| RSS pic | **4,2 Mo** | 16,3 Mo | 40,3 Mo | **13,7 Mo** (wasmtime) | runtime dédié raisonnable |
| Portabilité | ❌ par cible | 🟡 runtime | 🟡 runtime | ✅ même binaire | WASM vainqueur |
| Isolation | ❌ | ❌ | ❌ | ✅ sandbox | WASM vainqueur |
| Limites | — | lenteur ×237 | aucune sandbox | surcoût runtime (13,7-41 Mo), types faibles, WASI en devenir | |

(Chiffres : Exp 006 / `results.json` / `peak_rss.json`.)

## 7. Peut-on intégrer naturellement WASM et MCP ?

**OUI — démontré en 8/8** (Exp 005) : `tools/list` **généré automatiquement depuis les manifestes** → un plugin installé devient un jeu d'outils MCP **zéro intégration** côté agent ; `tools/call` routé vers le host qui conserve son **deny-by-default** (défense en profondeur : `needy_do_log` exposé mais refusé). La limite (types `number[]`) vient de l'absence de WIT, **pas de MCP**. Aucun projet public équivalent trouvé en Phase 2 → niche originale.

## 8. Existe-t-il une opportunité technique ou commerciale autour de cette infrastructure ?

**OUI, de niche claire et non pourvue** (raisonnement sur preuves Phase 2 + Exp 005) :
- **Technique** : la brique « manifeste WASM → sandbox → outils MCP pour agents » est faisable en ~400 lignes sans dépendance — tout éditeur voulant exposer ses fonctions *sécurisées* à un agent IA a besoin de cette couche (personne ne standardise le contrat hôte↔plugin : les 8 ABI concurrentes le prouvent).
- **Commercial** : le marché « plugins pour agents » (marketplaces d'outils IA) se heurte au problème n°1 de l'IA agentique = **exécution sûre de code tiers** ; WASM est le seul candidat avec sandbox + portabilité + 160 o. Le moment est opportun (WASI 0.3 livré, Component Model vers 1.0).
- **Risque** : les gâteaux-placeurs (VS Code, navigateurs, Shopify…) sont déjà verrouillés par leurs contrats maison ; l'opportunité est pour les **nouveaux entrants** (runners d'agents, plateformes low-code, edge).

---

## Réponse finale (§11)

> **WASM va loin comme infrastructure universelle de plugins — toute la mécanique est là, mesurée, et notre hôte le prouve en 250 lignes — mais « universel » reste à construire au-dessus du binaire : contrat, découverte, distribution.** L'expérience MCP montre que cette couche manquante se comble en quelques heures quand on l'invente soi-même ; le Component Model est la tentative officielle de la produire pour tous. « WASM sera le prochain MCP » est donc réfuté (ce sont des couches complémentaires : exécution vs interaction) ; « WASM peut être *la couche d'exécution* des systèmes de plugins des agents » est, lui, **confirmé**.
