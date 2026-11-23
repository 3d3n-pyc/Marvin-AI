# 🚀 MyEpitech - Marvin AI

> Extension de navigateur moderne (Chrome & Firefox MV3) débloquant l'interface native de l'assistant Marvin dans MyEpitech, connectée directement à **blade.sh** avec support d'outils intelligents (*function calling*).

---

## ✨ Fonctionnalités

- **Panneau Marvin intégré** : Bouton `MARVIN_` sur l'intranet [my.epitech.eu](https://my.epitech.eu) qui ouvre un panneau de chat propre à l'extension (fermeture par Échap).
- **blade.sh & Modèles récents** : Connexion à l'API compatible OpenAI de blade.sh (modèle par défaut `olala-v1.0-mini-7a1b`) en streaming ultra-fluide (SSE). Le modèle choisi doit supporter l'appel d'outils (*function calling*), car l'assistant s'appuie sur 13 outils.
- **Génération automatique de titres** : Titrage intelligent et contextuel de chaque conversation par IA avec nettoyage des pensées (*reasoning models*).
- **13 Outils d'inspection intégrés** : L'IA peut interroger en temps réel vos notes, crédits, compétences, projets, événements, absences, logtime et validations académiques.
- **Popup de configuration intégré** : Configuration graphique de la clé API blade.sh, du modèle et panneau de test de connectivité.
- **Support Multi-Navigateurs** : Manifest V3 standardisé pour Chromium (Service Worker) et Mozilla Firefox (Background Script).

---

## 📁 Architecture du Projet

```
Marvin-AI/
├── package.json               # Dépendances et commandes du projet
├── tsconfig.json              # Configuration TypeScript strict
├── build.mjs                  # Script de compilation esbuild ultra-rapide (< 20ms)
├── CHANGELOG.md               # Historique des versions
├── CONTRIBUTING.md            # Guide de contribution et format de changelog PR
│
├── src/                       # 🌟 Code source TypeScript
│   ├── assets/                # Icônes et ressources statiques
│   │   └── icons/             # Icônes PNG (16, 32, 48, 96, 128)
│   │
│   ├── background/            # Script d'arrière-plan (Proxy CORS vers blade.sh & communication)
│   ├── content/               # Content script (Injection du hook & bridge messages)
│   ├── popup/                 # Interface graphique popup (HTML, CSS, TypeScript)
│   │
│   ├── injected/              # Code injecté dans le contexte de la page my.epitech.eu
│   │   ├── page-hook.ts       # Bouton MARVIN_ et branchement du panneau
│   │   ├── chat/              # Panneau (Shadow DOM), moteur du chat, pont blade.sh
│   │   ├── definitions.ts     # Définition OpenAPI des 13 outils pour l'IA
│   │   ├── utils/             # Fonctions utilitaires (API, auth, dates, titres)
│   │   └── tools/             # Les 13 outils métiers modulaires (marks, absences, etc.)
│   │
│   ├── config.ts              # Configuration par défaut & accès storage
│   ├── logger.ts              # Système de log unifié [Marvin]
│   ├── types.ts               # Interfaces et types globaux
│   └── webext.ts              # Polyfill d'API multi-navigateurs (chrome / browser)
│
├── dist/                      # 📦 Paquets compilés prêts à charger (généré par build)
│   ├── chrome/                # Extension pour Google Chrome, Brave, Edge (MV3)
│   ├── firefox/               # Extension pour Mozilla Firefox (MV3)
│   └── releases/              # Archives .zip générées lors des releases
│
└── .github/                   # CI/CD GitHub Actions
    ├── pull_request_template.md # Modèle de Pull Request
    └── workflows/             # Workflows de vérification de changelog et de release
```

---

## ⚡ Commandes de Développement

```bash
# Installer les dépendances
npm install

# Compiler les extensions (Chrome & Firefox)
npm run build

# Mode observation (recompilation en direct à chaque sauvegarde)
npm run watch

# Vérification des types TypeScript
npm run typecheck

# Lancer les tests (node --test)
npm test

# Tester la conformité d'une PR / changelog en local
npm run lint:pr -- --title "feat: export note" --body "### Changelog\n#### New Features\n- Export note"
```

---

## 📥 Installation dans le Navigateur

### 🌐 Google Chrome / Brave / Edge (Chromium)

1. Ouvrez votre navigateur sur `chrome://extensions/`.
2. Activez le mode développeur (interrupteur en haut à droite).
3. Cliquez sur **"Charger le dossier non empaqueté"** (*Load unpacked*).
4. Sélectionnez le dossier **`dist/chrome/`**.
5. Cliquez sur l'icône de l'extension dans votre barre d'outils pour configurer votre clé d'API blade.sh (`sk-blade-…`) et choisir votre modèle. Votre clé est obligatoire : sans elle, le panneau affiche « clé manquante ».
6. Rendez-vous sur [my.epitech.eu](https://my.epitech.eu) !

### 🦊 Mozilla Firefox

1. Ouvrez Firefox et rendez-vous sur `about:debugging#/runtime/this-firefox`.
2. Cliquez sur **"Charger un module temporaire..."**.
3. Sélectionnez le fichier **`dist/firefox/manifest.json`**.
4. Configurez votre clé d'API blade.sh (`sk-blade-…`) via le popup de l'extension (obligatoire, sinon le panneau affiche « clé manquante »).
5. Rendez-vous sur [my.epitech.eu](https://my.epitech.eu) !

---

## 🤝 Contribution & Versioning

Les contributions sont les bienvenues ! Consultez le fichier [CONTRIBUTING.md](CONTRIBUTING.md) pour les détails sur la validation automatique du Changelog par notre bot CI.
