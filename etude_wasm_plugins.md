# Étude et prototypage d'une architecture universelle de plugins basée sur WebAssembly

## 1. Question centrale

**Comment WebAssembly peut-il devenir une infrastructure standard pour rendre les logiciels extensibles par des plugins portables, sécurisés et interopérables ?**

L'objectif n'est pas de partir de l'hypothèse que WASM deviendra « le prochain MCP », mais d'étudier objectivement son potentiel comme infrastructure universelle de plugins.

---

## 2. Les axes de recherche

### A. Comprendre l'infrastructure

Étudier les éléments fondamentaux de l'écosystème WebAssembly :

- WASM Core
- WASI
- WebAssembly Component Model
- WIT (WebAssembly Interface Types)
- Runtimes : Wasmtime, WasmEdge, Wazero, etc.
- Modèle de sécurité et de capabilities

**Question :**

> La technologie possède-t-elle réellement les propriétés nécessaires à un système universel de plugins ?

---

### B. Étudier ce qui existe déjà

Rechercher les systèmes qui utilisent déjà WASM comme mécanisme d'extension ou d'exécution :

- Plugins WASM
- Envoy et le networking
- Cloud et edge computing
- Bases de données
- Applications desktop
- Plateformes serverless
- Systèmes embarqués
- Autres environnements utilisant WASM pour l'extension ou le sandboxing

Comparer ensuite avec les approches traditionnelles :

```text
Plugin natif
Plugin Python
Plugin JavaScript
Plugin WASM
```

**Objectif :**

Déterminer les avantages, limites et conditions d'utilisation de chaque approche.

---

### C. Identifier le problème encore non résolu

Question centrale :

> Pourquoi chaque logiciel doit-il encore définir son propre système de plugins ?

Exemples :

- Un plugin VS Code n'est pas un plugin WordPress.
- Un plugin Figma n'est pas un plugin Obsidian.

WASM peut fournir une couche d'exécution commune, mais le contrat entre l'application et le plugin reste à définir.

Il faut donc étudier :

```text
                 WASM
                  │
          ┌───────┴───────┐
          │               │
     Exécution        Interface
          │               │
          │          Problème de
          │          standardisation
          └───────┬───────┘
                  ↓
       Standard de plugin ?
```

---

## 3. Comparaison avec MCP

MCP ne doit pas être considéré comme un concurrent direct de WASM.

Les deux technologies se situent à des niveaux différents.

| Critère | MCP | WASM |
|---|---|---|
| Problème principal | Communication IA/outils | Exécution portable |
| Nature | Protocole | Format/runtime |
| Objet | Outils, ressources, prompts | Code et composants |
| Sécurité | Contrôle des interactions | Sandbox + capabilities |
| Interopérabilité | IA ↔ outils | Composants ↔ runtimes |
| Découverte | Écosystème en développement | Écosystème encore fragmenté |
| Marketplace | Émergent | Fragmenté |
| Expérience développeur | Relativement simple | Plus complexe |

### Question de recherche

> Qu'est-ce qui manque à WASM pour offrir une expérience développeur et un écosystème comparables à ceux d'un protocole universel comme MCP ?

---

# 4. Construire un prototype

La recherche doit être accompagnée d'une expérimentation concrète.

Créer un petit :

> **Universal WASM Plugin Host**

Exemple d'organisation :

```text
HOUETOR Plugin Host

/plugins
   ├── calculator.wasm
   ├── csv.wasm
   └── hello.wasm
```

Le host devra idéalement permettre de :

1. Découvrir les plugins.
2. Vérifier leur manifeste.
3. Charger un plugin.
4. Lui accorder certaines permissions.
5. Appeler ses fonctions.
6. Retirer le plugin.
7. Installer une nouvelle version.
8. Mettre à jour un plugin sans modifier le logiciel principal.

L'objectif est volontairement limité : comprendre les difficultés réelles d'un système de plugins WASM.

---

# 5. Étudier le pont WASM × MCP

Une deuxième expérimentation pourra ensuite ajouter une couche MCP.

Architecture envisagée :

```text
                 Plugin WASM
                      │
                      ▼
                  WASM Host
                      │
                      ▼
                  MCP Bridge
                      │
                      ▼
                   Agent IA
```

### Exemple

Un développeur crée :

```text
facturation.wasm
```

Le logiciel l'installe.

Le bridge MCP pourrait exposer automatiquement certaines fonctions :

```text
create_invoice
get_invoice
calculate_total
```

L'agent IA pourrait alors utiliser ces fonctions.

### Question expérimentale

> Un composant WASM peut-il être transformé automatiquement ou semi-automatiquement en outil MCP ?

Cette question permettra d'explorer la complémentarité entre une infrastructure d'exécution et un protocole d'interaction avec les agents IA.

---

# 6. Méthodologie générale

Le travail sera organisé en quatre phases.

## Phase 1 — État de l'art

Étudier :

```text
WASM
  ↓
WASI
  ↓
Component Model
  ↓
WIT
  ↓
Runtimes
  ↓
Plugins
```

**Objectif :**

Comprendre précisément les technologies existantes et leur niveau de maturité.

---

## Phase 2 — Cartographie

Répertorier les projets utilisant WASM dans :

- les plugins ;
- les extensions ;
- le sandboxing ;
- le cloud ;
- l'edge computing ;
- l'IA ;
- les composants logiciels ;
- les systèmes embarqués.

**Objectif :**

Identifier où WASM fonctionne déjà et où son adoption reste limitée.

---

## Phase 3 — Prototype

Développer le **Universal WASM Plugin Host**.

**Objectif :**

Identifier les difficultés techniques réelles et mesurer les performances du modèle.

---

## Phase 4 — WASM × MCP

Ajouter une couche MCP au prototype.

**Objectif :**

Déterminer si un système de plugins WASM peut naturellement devenir une infrastructure de capacités utilisables par les agents IA.

---

# 7. Critères de mesure

Le prototype doit permettre d'effectuer des comparaisons objectives.

Mesures possibles :

- Temps de chargement d'un plugin
- Temps d'exécution
- Mémoire utilisée
- Taille du plugin
- Isolation du plugin
- Niveau de contrôle des permissions
- Temps d'installation
- Temps de mise à jour
- Portabilité
- Complexité d'intégration
- Facilité de retrait
- Gestion des versions
- Gestion des dépendances

---

# 8. Comparaison expérimentale

Une même fonctionnalité pourra être implémentée sous plusieurs formes :

```text
Plugin natif
     VS
Plugin Python
     VS
Plugin JavaScript
     VS
Plugin WASM
```

Les différentes implémentations seront comparées selon les critères définis précédemment.

L'objectif est d'obtenir des résultats mesurables plutôt que de partir d'une simple opinion sur les avantages de WASM.

---

# 9. Hypothèse de recherche

L'hypothèse à tester peut être formulée ainsi :

> **WebAssembly, associé à WASI et au Component Model, pourrait fournir une base technique suffisamment portable, sécurisée et légère pour constituer une infrastructure commune de plugins logiciels, à condition de résoudre les problèmes d'interfaces, de permissions, de découverte, de distribution et de compatibilité entre applications.**

Cette hypothèse devra être confirmée, nuancée ou réfutée par l'état de l'art et les expérimentations.

---

# 10. Titre de travail

## Étude et prototypage d'une architecture universelle de plugins basée sur WebAssembly

### Sous-titre possible

**Interopérabilité, sécurité, portabilité et intégration avec les agents IA via MCP**

---

# 11. Résultat attendu

À la fin de l'étude, le projet devra permettre de répondre clairement aux questions suivantes :

1. Que permet réellement WASM aujourd'hui ?
2. Quel est le niveau de maturité de WASI et du Component Model ?
3. Quels systèmes utilisent déjà WASM comme infrastructure de plugins ?
4. Quels problèmes empêchent encore une véritable universalité ?
5. Peut-on construire un host de plugins WASM générique ?
6. Quels sont ses avantages et ses limites face aux plugins traditionnels ?
7. Peut-on intégrer naturellement WASM et MCP ?
8. Existe-t-il une opportunité technique ou commerciale autour de cette infrastructure ?

Le but final n'est donc pas de démontrer que **« WASM sera le prochain MCP »**, mais de déterminer, preuves et prototype à l'appui, **jusqu'où peut aller WASM comme infrastructure universelle de plugins**.
