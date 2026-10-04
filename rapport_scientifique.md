# Rapport scientifique — Architecture universelle de plugins basée sur WebAssembly

> **Sujet** : étude et prototypage d'une architecture universelle de plugins WASM (interopérabilité, sécurité, portabilité, intégration agents IA via MCP).
> **Date** : 2026-10-04 · **Repo** : https://github.com/bolouvipf/houetorwasm.git (branche `main`, dernier commit `82ee0f0`)
> **Nature** : rapport de travaux de recherche appliquée, 4 phases, 21 expériences instrumentées.
> **Règle de preuve** : toute affirmation chiffrée renvoie à un artefact reproductible (`prototype/bench/*.mjs` → JSON brut) ; la **source de vérité des chiffres** = `phase3_measures.md` + JSON (règle 7 du lab, `AGENTS.md` §5).

**Mots-clés** : WebAssembly, WASI, Component Model, WIT, sandbox, capabilities, plugin, MCP, manifeste, portabilité.

---

## Résumé

Nous avons étudié la question de savoir si WebAssembly peut servir de socle **universel** pour des systèmes de plugins. Plutôt que de n'étudier qu'un logiciel existant, nous avons construit le logiciel sujet d'expérience — le **HOUETOR Plugin Host** (~725 lignes JavaScript, zéro dépendance) — et l'avons instrumenté sur 21 expériences datées. Résultats principaux : (1) sous runtime dédié, un plugin WASM s'exécute à **≈1,5× le temps du natif** (médiane de 5 campagnes, fourchette 0,6–1,9×), avec un artefact de **160 octets** et une mémoire runtime de 14 Mo (wasmtime) contre 41 Mo (Node) ; (2) le même binaire tourne à l'identique sur **2 systèmes d'exploitation, 3 moteurs d'exécution indépendants, 7 combinaisons**, donnant un résultat identique ; (3) l'isolation est démontrée de bout en bout : imports hôtes refusés par défaut, lecture/écriture fichiers confinées (évasion `../` refusée), distribution signée (sha256 + Ed25519) et garde-fous anti-DoS coupant une boucle infinie de 60,2 s à 313 ms ; (4) le Component Model (WIT) est exécuté pour de vrai, le contrat et les capabilities se lisant **dans le binaire avant exécution** ; (5) le manifeste se traduit automatiquement en outils MCP pour agents IA, avec politique allow/deny fail-closed. Enfin, la comparaison avec le cadre tiers de référence **Extism** confirme empiriquement la thèse centrale : **le calcul est universel, le contrat ne l'est pas** — nos binaires y sont refusés et les siens par nous, alors que le même plugin renvoie la même valeur (5.5) partout. L'hypothèse de l'étude est donc **confirmée côté technique** et **nuancée côté écosystémique** : la barrière n'est pas le runtime mais l'absence de standard sémantique, de registre et d'ancre de confiance.

---

## 1. Introduction et problématique

### 1.1 Contexte

Un « universel » des plugins supposerait un artefact binaire unique, exécutable partout, isolé par construction, avec des permissions déclarables et une distribution vérifiable. WebAssembly (WASM) offre, du point de vue *mécanique*, ces propriétés : exécution sandboxée par défaut, portabilité multi-plateforme, surcoût proche du natif. La littérature et l'industrie revendiquent pourtant des contrats d'interface hétérogènes (proxy-wasm, ABI maison, WIT, NaN-boxing, dlopen signé…), ce qui suggère que l'universalité réelle s'arrête avant le contrat.

### 1.2 Questions et hypothèse

L'étude de référence (`etude_wasm_plugins.md`) pose 4 questions (A : propriétés mécaniques ; B : maturité WASI/Component Model ; C : diversité réelle des contrats ; D : distribution/découverte) et une hypothèse (§9) :

> *« WASM + WASI + Component Model pourraient constituer une infrastructure commune de plugins, à condition de résoudre interfaces, permissions, découverte, distribution et compatibilité. »*

**Thèse opérationnelle (question C)** : *le binaire est universel, le contrat ne l'est pas.* Elle est testée deux fois : sur notre propre hôte (phases 3-4) et sur un tiers indépendant (Extism, Exp 021).

### 1.3 Déméthodologie

Conformément au protocole (§6 de l'étude), la Phase 3 étudie **un logiciel que nous construisons nous-mêmes** (HOUETOR Plugin Host), ce qui permet d'instrumenter chaque critère du §7 sans accès aux entrailles d'un sujet tiers. Les Phases 1-2 (état de l'art, cartographie) restent documentaires et sourcées.

---

## 2. Matériel et méthodes

### 2.1 Environnement expérimental

| Composant | Version / valeur |
|---|---|
| Machine | Windows x86-64, 8 cœurs (WSL2 Ubuntu 26.04 pour la jambe Linux) |
| Hôte testé | HOUETOR Plugin Host, `prototype/host/host.mjs` (≈725 lignes, **0 dépendance**) |
| Pont MCP | `prototype/mcp/bridge.mjs` (≈229 lignes, 0 dépendance) |
| Moteurs | wasmtime **49.0.2** (Cranelift), wazero **1.12** (Go), node:wasi (V8) |
| Outils composants | wit-bindgen **0.62.0**, wasm-tools **1.261.0** |
| Cadre tiers de comparaison | Extism CLI **1.6.3** (sha256 du zip vérifié), runtime wazero |
| Chaîne | Rust **1.99.0** (cibles `wasm32-unknown-unknown`, `wasm32-wasip1`, `wasm32-wasip2`), Node **24.15.0**, Python **3.14**, clang/LLVM-MinGW **22.1.8** |

### 2.2 Méthode de mesure

- **Campagnes** : `BENCH_RUNS=9` appels par point, **médianes** publiées avec fourchettes sur 5 campagnes (Exp 009) — jamais un point unique.
- **Normalisation** : charge de travail `K` différente par jambe, mais la grandeur publiée (`per_call_ns`) est normalisée ; accumulateur obligatoire (correction du bloat « dead-code » en Exp 004).
- **Mémoire** : RSS pic mesuré par **polling externe** (`peak_rss.ps1`), non par le processus lui-même.
- **Barrière de mesure** : `wall_ms` inclut le spawn du runtime ; `compute_ms` isole le calcul — raison d'être de la distinction.
- **Reproductibilité** : chaque résultat correspond à un script de banc (`prototype/bench/*.mjs`) produisant un JSON ; **aucun chiffre « à la main »** (règle 6 du lab).
- **Échec honnête** : les limites mesurées sont publiées telles quelles (§6), y compris quand elles défavorisent notre propre prototype.

### 2.3 Répartition des preuves

21 expériences (`EXPERIMENTS_LOG.md`), regroupées par thème : comportement/deny (001-003), performance (004-006, 009), portabilité (007, 010), cycle de vie (008), capabilities fichiers (011-012), distribution + intégrité + provenance (013-016), pont MCP (005, 015, 019), composants WIT (018), anti-DoS (020), comparaison de cadres (021). (L'identifiant Exp 017 est réservé et jamais utilisé.)

---

## 3. Résultats

### 3.1 Phase 1-2 — l'existant ne partage aucun contrat

- **Phase 1** (`phase1_etat_de_l_art.md`) : propriétés *mécaniques* confirmées (portabilité, sandbox, permissions système WASI, performance) ; propriétés *écosystémiques* absentes (contrat sémantique, découverte, distribution).
- **Phase 2** (`phase2_cartographie.md`) : **8 domaines** (A-H) audités avec sources datées ; **≥8 contrats d'interface hétérogènes** coexistent pour un format censé être universel ; adoption web réelle **0,35 %** des sites ; Docker Wasm abandonné 🔴 ; proxy-wasm gelé chez APISIX depuis 2021 🟡. VS Code et les navigateurs **n'utilisent pas** WASM comme runtime d'extension.

### 3.2 Phase 3 — le prototype HOUETOR

L'hôte couvre les 8 étapes du cycle de vie §4 (Exp 003, 8/8) : découverte, validation du manifeste, chargement, permissions, appel, retrait, versionnage, mise à jour. Points notables :

**a) Performance (étude §8, 5 jambes).** Campagne canonique n=9 :

| Jambe | Temps médian par appel |
|---|---|
| Natif (C compilé) | **7,2 ns** |
| wasmtime (spawn) | **13,9 ns** |
| WASM via hôte Node | **24,5 ns** |
| JavaScript | **34,3 ns** |
| Python | **1 593,6 ns** |

Ratios stables sur 5 campagnes : wasmtime ≈ **×1,5 du natif** (fourchette 0,6–1,9×, borne basse = bruit de mesure) ; hôte WASM **1,4–2,2× plus rapide que le JS** ; Python **65–238× plus lent**. RSS pic : wasmtime **14,4 Mo**, wazero **16,1 Mo**, Node **40,5 Mo** — un runtime dédié coûte 2,5–3× moins que Node, payé une fois pour N plugins. Taille du plugin minimal : **160 octets** (vs 88 064 o en natif, 135 641 o pour un exécutable WASI Rust complet).

**b) Portabilité.** Un **même fichier binaire** exécuté sur **2 OS** (Windows + Linux/WSL2), **4 exécuteurs**, **3 moteurs indépendants**, **7 combinaisons** → résultat identique `1134903170` (Exp 007+010). C'est la propriété *mécanique* la mieux démontrée de l'étude.

**c) Isolation et permissions.** Imports hôtes refusés **par défaut** (deny-by-default, Exp 003/005) ; capabilities fichiers WASI **en lecture et écriture** : accord → OK, évasion `data/../` → refusée (code os 63/63/76 selon moteur), aucun accord → refus, montage `ro` → écriture bloquée ; fichier malveillant (`evil.txt`) **jamais créé** (21 checks, Exp 011-012). Sur le plan applicatif : **double verrou** = allow-list d'hôte (`HOST_ALLOWED = ["wasi:filesystem"]`) ∩ montages explicites (`HOUETOR_PREOPENS`) — déclarer la permission n'ouvre aucun fichier.

**d) Distribution, intégrité, provenance.** Registre local + installation HTTP (découverte → téléchargement → validation → mise à jour versionnée, install 224 ms, Exp 013, 11/11) ; **épinglage sha256** du binaire obligatoire à distance et revérifié à chaque chargement — altération post-install détectée (Exp 014, 15/15) ; **signature Ed25519** des manifestes (`manifest.sig`) avec ancrage `HOUETOR_TRUST_KEYS`, sig sans clé de confiance = refus explicite (Exp 016, 12/12). Chaîne : clé privée → manifeste → sha256 → octets wasm.

**e) Cycle de vie chronométré.** install **18,5 ms**, update (v1→v2 avec archivage `.history`) **24,7 ms**, remove **14,2 ms** en temps fichier net (Exp 008).

**f) Composants WIT (Component Model exécuté).** Plugin `witcalc` : package `houetor:calc@0.1.0`, composant **94 668 o**. La **WIT et la surface de capabilities se lisent dans le binaire** sans l'exécuter (`wasm-tools component wit`), l'exécution se fait en WAVE (`add(2, 3.5)` → 5.5), les erreurs de type sont **refusées avant exécution**, et un composant qui importe le filesystem sans permission **ne se charge pas** (déni statique, Exp 018, 20/20).

**g) Anti-DoS.** `HOUETOR_FUEL` / `HOUETOR_TIMEOUT` câblés sur wasmtime : plugin malveillant `spinhog` (boucle infinie) **bloque l'hôte 60 194 ms sans limites → coupé à 313 ms (fuel) / 500 ms (timeout)** ; sous la **même limite**, `add` et `fibonacci(45)` restent corrects — la coupure est sélective, pas globale ; toute valeur invalide ou appliquée à un chemin non fuel-limable = **refus fail-closed** (Exp 020, 12/12).

### 3.3 Phase 4 — du manifeste aux outils MCP

`tools/list` est **généré automatiquement depuis les manifestes** installés ; `tools/call` route vers l'hôte ; pour les composants, l'`inputSchema` porte des **propriétés nommées typées issues du WIT** (`{a: number, b: number}`) et le bridge mappe nommé → positionnel en refusant les paramètres manquants (Exp 019). Défense en profondeur à **trois barrières** : bridge (protocole) → policy allow/deny fail-closed (Exp 015, 9/9) → hôte (sandbox). Régressions vertes après chaque changement : 8/8, 9/9, 15/15, 12/12, 20/20.

### 3.4 Comparaison avec un cadre existant — Extism (Exp 021)

Le cadre tiers **Extism 1.6.3** (CLI officielle dont le sha256 du zip a été vérifié, runtime wazero) a été confronté à nos binaires, avec un plugin écrit dans son **PDK Rust officiel** (`extism-pdk 1.4.1`) — **11/11 checks** :

| Observation | Sortie brute |
|---|---|
| Notre module (ABI `nombre[]`) sous Extism | `Error: expected 2 params, but passed 0` |
| Notre composant WIT sous Extism | `Error: invalid version header` (pas de Component Model) |
| Plugin PDK : `add "2 3.5"` | `5.5` — **même valeur que nos 7 combinaisons** |
| Import hôte inconnu (`env.host_log`) | `Error: module[env] not instantiated` (deny aussi chez eux) |
| Manifeste `allowed_hosts: []` | `HTTP request ... is not allowed (recovered by wazero)` |
| Manifeste `timeout_ms: 500` | `Error: timeout` coupé en 1 064 ms |
| `memory.max_pages` | refuse le chargement, **mais 64 MiB alloués sous un plafond de 2 MiB** (limite non bloquante) |

**Interprétation** : les deux cadres, écrits indépendamment, produisent les mêmes verdicts de sécurité (imports inconnus refusés, HTTP fermé par défaut, garde-fou temporel) mais **n'acceptent pas les mêmes binaires**. Le calcul traverse les cadres ; le contrat non.

---

## 4. Discussion

### 4.1 Réponse aux questions

- **A — propriétés mécaniques** : **confirmées par la mesure** (portabilité 2 OS/3 moteurs, sandbox prouvée par évasion refusée, perf ≈1,5× natif, artefact 160 o).
- **B — maturité WASI/CM** : **partielle** — WASI 0.2 livré en 2024, 0.3 le 2026-06-11 (async livré, threads absents), 1.0 attendu fin 2026/début 2027 ; le Component Model *fonctionne* (Exp 018) mais l'outiling reste fragile (fragments de commande changent d'une version à l'autre).
- **C — diversité des contrats** : **confirmée deux fois**, sur notre hôte et sur Extism (§3.4).
- **D — distribution/découverte** : **non résolu par le standard** ; contourné en labo par un manifeste + registre maison (Exp 013-016) — ce qui prouve à la fois la faisabilité et l'absence de standard (personne n'a de registre universel, ni PKI d'ancre).

### 4.2 Hypothèse §9

**Confirmée côté technique, nuancée côté écosystémique.** Tous les verrous *logiciels* de l'hypothèse ont été levés par un hôte de ~725 lignes : ce qui manque n'est pas du runtime mais **du standard sémantique** (contrat commun), **du standard de distribution** (registre) et **de la confiance transverse** (PKI) — précisément le rôle assigné au Component Model/WASI 1.0.

### 4.3 Le WASM est-il « meilleur qu'un plugin natif/Python/JS » ?

Pas sur chaque axe : le natif gagne en vitesse pure, le JS en intégration web. Le WASM est le seul format cumulant ≈1,5× du natif **avec** une sandbox par défaut, la portabilité multi-OS, un artefact de 160 o et un coût marginal par plugin négligeable (compile 1-2 ms + 160 o) : c'est le meilleur **triangle** compromis, pas le vainqueur brut. Le coût réel est le runtime (14-41 Mo), **payé une fois pour N plugins**.

---

## 5. Limites et validité (menaces à la validité)

1. **Une machine, une charge** : fib est *compute-bound* ; les absolus varient ×2-×3 selon l'état machine (Exp 009) — seuls les **ratios** sont publiés ; aucune mesure multi-thread (WASI 0.3 n'a pas encore les threads).
2. **Borne basse 0,6×** (WASM « plus rapide » que le natif) = **bruit de mesure**, explicitement rejeté dans les conclusions (§6 de `phase3_measures.md`) — la valeur retenue est la médiane ×1,5.
3. **Unités de fuel non portables** d'une version de wasmtime à l'autre : garde-fou, pas un budget transférable ; chemin module core in-process **non fuel-limable** → il est *refusé* sous limite (recommandation assumée : composants pour le code non fiable).
4. **Plafond mémoire non câblé** côté HOUETOR (`-W max-memory-size` existe, non branché) — alors qu'Extism expose `memory.max_pages`, même si notre test montre qu'il n'a pas bloqué la croissance (Exp 021 X10). Lacune assumée et priorisée en suite.
5. **Comparaison Extism asymétrique** : le CLI officiel a été testé, pas un produit intégrant `extism-runtime` ; les performances n'ont **pas** été rejetouées sous Extism (on compare des *contrats*, pas des nanosecondes).
6. **Distribution des clés = humaine** : la signature Ed25519 prouve l'intégrité, pas l'identité (pas de PKI) ; signature du manifeste ≠ audit du contenu.
7. **MacOS et navigateur non testés** : la portabilité est démontrée Windows + Linux uniquement.
8. **Aucun utilisateur final** : le pont MCP a été validé contre un client JSON-RPC maison, pas encore contre Claude Desktop/inspector — l'interopération avec un client tiers réel reste à faire.

---

## 6. Reproductibilité

Tout est rejouable depuis le dépôt (détail : `phase3_measures.md` §7) :

```powershell
node "prototype\bench\run_bench.mjs"        # comparatif §8 (BENCH_RUNS=9)
powershell -File "prototype\bench\peak_rss.ps1"
node "prototype\bench\portability.mjs"      # Exp 007
powershell -File "prototype\bench\portability_os.ps1"   # Exp 010 (WSL2)
node "prototype\bench\lifecycle.mjs"        # Exp 008
node "prototype\bench\wasi_caps.mjs"        # Exp 011
node "prototype\bench\wasi_write.mjs"       # Exp 012
node "prototype\bench\registry_test.mjs"    # Exp 013+014 (15/15)
node "prototype\bench\sig_test.mjs"         # Exp 016 (12/12)
node "prototype\bench\component_test.mjs"   # Exp 018+019 (20/20)
node "prototype\bench\fuel_test.mjs"        # Exp 020 (12/12)
node "prototype\bench\extism_test.mjs"      # Exp 021 (11/11)
```

Artefacts : `prototype/bench/*.json`, `prototype/plugins/{hello,needy,witcalc}`, échantillons `prototype/samples/{witcalc,spinhog,extplug}`. Journal complet : `docs-learning/EXPERIMENTS_LOG.md` (sorties brutes Exp 001→021).

---

## 7. Conclusion et travaux futurs

**Conclusion.** WebAssembly remplit *techniquement* le cahier des charges d'un socle de plugins universel : nous l'avons démontré avec un hôte de 725 lignes couvrant le cycle de vie complet, des mesures de performance proches du natif (≈1,5×), une portabilité multi-OS multi-moteurs avérée, une isolation validée par évasion refusée et garde-fous temporels, une distribution signée, l'exécution du Component Model et la génération automatique d'outils MCP pour agents IA. Mais l'universalité **réelle** bute sur ce qui n'est pas du runtime : ≥8 contrats hétérogènes (Phase 2), refus croisés des binaires avec Extism (Exp 021), absence de registre et d'ancre de confiance universels. *Le binaire est universel ; le contrat ne l'est pas* — c'est désormais une mesure, plus une opinion.

**Travaux futurs** (par ordre de valeur) : (1) plafond mémoire `max-memory-size` pour fermer la dernière asymétrie avec Extism ; (2) WASI réseau (sockets 0.3) ; (3) interopération avec un **vrai client MCP tiers** (Claude Desktop/inspector) ; (4) portabilité macOS/navigateur ; (5) hôte wasmtime en Rust pour supprimer le spawn Node ; (6) à l'échelle du marché : standardisation du contrat (Component Model 1.0), registre commun et PKI d'ancre — hors portée d'un labo, mais précisément le vrai sujet de l'étude.

---

## Références (datées, vérifiées le 2026-10-04)

1. `etude_wasm_plugins.md` — cahier de l'étude (questions A-D, hypothèse §9, critères §7).
2. `phase1_etat_de_l_art.md` — état de l'art (sources datées, matrice de maturité 13 lignes).
3. `phase2_cartographie.md` — cartographie 8 domaines A-H.
4. `phase3_measures.md` + `prototype/bench/*.json` — **source de vérité des chiffres**.
5. `phase4_mcp_bridge.md` — pont WASM × MCP.
6. `conclusion.md` — réponses aux 8 questions §11 + verdict §9.
7. `docs-learning/EXPERIMENTS_LOG.md` — journal des 21 expériences (preuves brutes).
8. Extism, Dylibso — https://extism.org/ · CLI v1.6.3 : https://github.com/extism/cli/releases (accédé le 2026-10-04, sha256 du zip vérifié `47e4ed2782445b2b08a4d1ac127211588f8b4d1fc25fd6481d4cb65151b5213c`).
9. wasmtime v49.0.2, wazero v1.12.0, wit-bindgen v0.62.0, wasm-tools v1.261.0 (versions d'outillage, 2026-10-04).
