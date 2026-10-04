# LEARNING_STATE — État actuel et point de reprise

> Dernière mise à jour : **2026-10-04** (session 1 — suite)

## Fait ✅

1. **Phase 1 — État de l'art livrée** → `phase1_etat_de_l_art.md` (sources datées, matrice de maturité 13 lignes).
   - **Conclusion** : propriétés *mécaniques* ✅ (exécution, isolation, portabilité, permissions) / propriétés *écosystémiques* ❌ (contrat sémantique, découverte, distribution) → terrain du prototype.
2. **Structure d'étude** façon lab HOUETOR : `AGENTS.md`, `docs-learning/{ROADMAP,LEARNING_STATE,EXPERIMENTS_LOG}.md`, `phase2_cartographie.md`.
3. **Repo GitHub** : `https://github.com/bolouvipf/houetorwasm.git` (branche `main`, commit `6784a11` poussé — 9 fichiers).
4. **Toolchain locale installée** : wasmtime **49.0.2**, Rust **1.99.0** (+ cibles `wasm32-unknown-unknown`, `wasm32-wasip2`), Node **v24.15.0**. GPU : aucun (inutile ici).
5. **Phase 3 — MVP du HOUETOR Plugin Host** → `prototype/` :
   - `host/host.mjs` : list / info / run / bench / install / remove, **deny-by-default**.
   - `plugins/hello@1.0.1` (Rust, 160 B) + `plugins/needy@1.0.0` (plugin exigeant `env.host_log` → refusé).
   - **8/8 étapes du §4 démontrées** avec sorties brutes → Exp 003 dans `EXPERIMENTS_LOG.md`.
   - Mesures brutes : cold load **7,3 ms** (compile 1,9 + inst 0,3), appel moyen **0,000436 ms (436 ns)**, wasm **160 B**, mémoire **1 Mo**.

## À faire ⏳ (ordre recommandé)

1. **Compléter `phase2_cartographie.md`** (domaines C à H : bases de données, desktop, embarqué, échecs).
2. **`phase3_measures.md`** : comparaison du §8 (même fonctionnalité en natif/Python/JS/WASM) via scripts reproductibles.
3. Étendre le host : **WASI 0.2 réel** (capabilities fichier/réseau via wasmtime), signature/provenance des plugins, appel avec chaînes (Canonical ABI ou host functions).
4. **Phase 4 — pont MCP** : `Plugin WASM → host → MCP Bridge → agent IA`.
5. Remplir les réponses §11 de l'étude (8 questions finales).

## Point de reprise exact

> Reprendre à **l'étape 1** (compléter la cartographie Phase 2) ou directement **étape 2** (comparatif de mesures Phase 3) selon la priorité.
> Vérifier l'outillage : `wasmtime --version` (PATH utilisateur), `cargo --version` (redémarrer le shell si besoin).
> En cas de doute : relire `AGENTS.md` §2 (ordre de lecture) et `EXPERIMENTS_LOG.md` (dernier : Exp 003).

## Décisions de session

- **2026-10-04** : « GPU en ligne ? » → **GPU inutile** (aucune tâche parallélisable sur GPU) ; accélération = toolchain locale + recherches web parallélisées.
- **2026-10-04** : le logiciel étudié en Phase 3 est **celui que nous créons** (HOUETOR Plugin Host), conformément au document source.
- **2026-10-04** : hôte MVP en **Node** (zéro build, mesure immédiate) ; **wasmtime** reste l'arme de choix pour la suite (WASI + capabilities réelles).
- **2026-10-04** : source du plugin rangée **dans** `plugins/<nom>/` (Cargo.toml + src) — `target/` ignoré par git.

## Reste connu (mineur)

- `plugins/hello/target/` contient un build 1.0.0 résiduel (sans importance, ignoré par git).
- `prototype/samples/hello-v2/` et `samples/needy/` = sources servant à `install` (needy : `-C link-arg=--allow-undefined` requis).
