# Changelog

Toutes les modifications notables de ce projet sont consignées dans ce document.

## [v2.0.1] - 2026-11-23

### ⚡ Améliorations
- L'extension déclare à Firefox les données envoyées à blade.sh pour générer les réponses ([#5](https://github.com/3d3n-pyc/Marvin-AI/pull/5) par @3d3n-pyc)
- Nouveau design du popup et du panneau de chat, plus lisible et plus sobre ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- Les étapes de l'assistant s'affichent en clair (par exemple « Lecture des absences ») au lieu des noms techniques ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- Le panneau indique ce que Marvin sait faire quand la discussion est vide ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- Le popup indique si une clé est déjà enregistrée et où en obtenir une ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- Navigation au clavier et lecteurs d'écran mieux pris en charge ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- L'assistant demande confirmation avant de valider une présence ou de répondre à une invitation de projet ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)
- L'assistant utilise désormais blade.sh : renseigner sa clé blade.sh dans le popup (Ollama Cloud n'est plus supporté) ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)
- L'extension demande moins de permissions (plus d'accès aux onglets, https uniquement) ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)

### 🐛 Corrections de bugs
- Sur Firefox, Marvin répond à nouveau : le popup propose d'autoriser l'accès à blade.sh quand il manque ([#5](https://github.com/3d3n-pyc/Marvin-AI/pull/5) par @3d3n-pyc)
- Les erreurs réseau s'affichent avec un message clair au lieu de « NetworkError » ([#5](https://github.com/3d3n-pyc/Marvin-AI/pull/5) par @3d3n-pyc)
- Le bouton MARVIN_ ouvre à nouveau l'assistant, désormais dans un panneau propre à l'extension ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)
- Les erreurs (clé manquante, délai dépassé, erreur API) s'affichent dans le panneau avec un bouton « Réessayer » ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)

### 👥 Contributeurs
Merci à @3d3n-pyc pour leurs contributions !

## [v2.0.0] - 2026-11-23

### ⚡ Améliorations
- Nouveau design du popup et du panneau de chat, plus lisible et plus sobre ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- Les étapes de l'assistant s'affichent en clair (par exemple « Lecture des absences ») au lieu des noms techniques ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- Le panneau indique ce que Marvin sait faire quand la discussion est vide ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- Le popup indique si une clé est déjà enregistrée et où en obtenir une ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- Navigation au clavier et lecteurs d'écran mieux pris en charge ([#2](https://github.com/3d3n-pyc/Marvin-AI/pull/2) par @3d3n-pyc)
- L'assistant demande confirmation avant de valider une présence ou de répondre à une invitation de projet ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)
- L'assistant utilise désormais blade.sh : renseigner sa clé blade.sh dans le popup (Ollama Cloud n'est plus supporté) ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)
- L'extension demande moins de permissions (plus d'accès aux onglets, https uniquement) ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)

### 🐛 Corrections de bugs
- Le bouton MARVIN_ ouvre à nouveau l'assistant, désormais dans un panneau propre à l'extension ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)
- Les erreurs (clé manquante, délai dépassé, erreur API) s'affichent dans le panneau avec un bouton « Réessayer » ([#1](https://github.com/3d3n-pyc/Marvin-AI/pull/1) par @3d3n-pyc)

### 👥 Contributeurs
Merci à @3d3n-pyc pour leurs contributions !

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère à [Semantic Versioning](https://semver.org/lang/fr/).

## [v1.0.0] - 2026-09-17

🎉 **Version initiale de Marvin AI pour MyEpitech**

### 🚀 Fonctionnalités
- Intégration de l'assistant Marvin directement dans l'intranet [my.epitech.eu](https://my.epitech.eu) avec streaming en direct.
- Connexion directe à Ollama Cloud pour utiliser des modèles récents (`gemma4`, `llama3`, etc.).
- 13 outils métiers d'inspection : notes, crédits, absences, projets, logtime, événements et validations académiques.
- Titrage automatique et contextuel des conversations par IA.
- Interface popup de configuration pour la clé d'API et le modèle avec outil de test de connexion.
- Compatibilité multi-navigateurs native Manifest V3 pour Google Chrome et Mozilla Firefox.
