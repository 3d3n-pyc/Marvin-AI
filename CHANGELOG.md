# Changelog

Toutes les modifications notables de ce projet sont consignées dans ce document.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère à [Semantic Versioning](https://semver.org/lang/fr/).

## [v1.0.0] - 2026-09-17

### 🚀 Nouvelles fonctionnalités
- Refonte complète de la suite Marvin AI en TypeScript moderne avec JSDoc standardisé.
- Support natif multi-navigateurs avec builds dédiés pour Google Chrome (MV3 service worker) et Mozilla Firefox (MV3 background script).
- Intégration du système de génération automatique de titres IA via Ollama Cloud avec prompt enrichi et assainissement des balises de pensée.

### ⚡ Améliorations
- Build ultra-rapide avec esbuild (< 20ms).
- Système de logging unifié `[Marvin]` avec horodatage et niveau d'alerte.
- Synchronisation automatique des versions de manifest depuis `package.json`.

### 🛠️ Détails techniques
- Mise en place du pipeline de validation de changelog automatisé et fork-safe façon SkyHanni.
