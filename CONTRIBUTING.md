# Guide de Contribution - Marvin AI

Bienvenue sur Marvin AI ! Ce guide vous explique comment contribuer proprement au projet.

---

## 🛠️ Développement local

```bash
# 1. Installer les dépendances
npm install

# 2. Vérifier les types TypeScript
npm run typecheck

# 3. Compiler les paquets (Chrome & Firefox)
npm run build

# 4. Mode observation (recompile automatiquement)
npm run watch
```

Les extensions compilées sont disponibles dans :
- `dist/chrome/` (Google Chrome, Brave, Edge)
- `dist/firefox/` (Mozilla Firefox)

---

## 📋 Règles de Pull Request & Changelog

Chaque Pull Request contribuant au projet doit respecter notre système de changelog automatisé.

### 1. Titre de la PR
- Au moins 8 caractères.
- Ne doit pas se terminer par un point `.`.
- Préfixe recommandé : `feat:`, `fix:`, `refactor:`, `docs:`, ou `[Module]`.

### 2. Description & Changelog
La description de votre PR doit comporter au moins une catégorie de changelog avec des puces (`- ...`). Décrivez **ce que l'utilisateur voit ou gagne**, pas le code interne.

```markdown
### Changelog
#### New Features
- Ajout d'un bouton d'export des résultats en un clic

#### Improvements
- Réduction du délai d'attente de réponse IA à 2 secondes

#### Fixes
- Correction du décalage d'affichage dans la sidebar
```

### 3. Exemption de Changelog
Si votre PR ne modifie aucun comportement visible (refactorisation interne, maintenance CI, correction de typo dans la doc) :
Ajoutez simplement la mention suivante dans votre description :
```text
exclude_from_changelog
```

---

## 🔍 Tester la conformité localement

Avant d'ouvrir ou de pousser sur votre PR, vous pouvez tester la conformité de votre changelog en local :

```bash
npm run lint:pr -- --title "Mon titre de PR" --body "### Changelog\n#### Fixes\n- Ma correction détaillée"
```

---

## 🚀 Processus de Release

Le changelog de chaque version (`CHANGELOG.md`) est assemblé automatiquement lors des releases.

Pour tester la génération de notes de release localement :
```bash
npm run release:dry
```
