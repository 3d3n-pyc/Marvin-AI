#!/usr/bin/env node
/**
 * @file verify-pr-changelog.mjs
 * @description Linter ultra-rapide et strict pour valider le titre et le changelog des Pull Requests.
 * Compatible GitHub Actions (lit GITHUB_EVENT_PATH) et exécution locale (CLI flags).
 */

import fs from 'node:fs';
import path from 'node:path';

// Parse arguments de ligne de commande
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

let title = getArg('title');
let body = getArg('body');
let prNumber = getArg('pr');
let outputPath = getArg('output') || 'build/changelog-result.json';

// Si exécuté dans GitHub Actions, lire l'event JSON
if (process.env.GITHUB_EVENT_PATH && (!title || !body)) {
  try {
    const eventData = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    if (eventData.pull_request) {
      title = title || eventData.pull_request.title || '';
      body = body || eventData.pull_request.body || '';
      prNumber = prNumber || eventData.pull_request.number;
    }
  } catch (err) {
    console.warn('[Marvin Linter] Impossible de lire GITHUB_EVENT_PATH:', err.message);
  }
}

title = (title || '').trim();
body = (body || '').trim();

/**
 * Nettoie les commentaires HTML d'un texte markdown (ex: <!-- ... -->)
 * @param {string} text
 * @returns {string}
 */
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Catégories supportées et leurs synonymes normalisés
 */
const CATEGORY_MAPPINGS = [
  { key: 'New Features', pattern: /^#{2,4}\s*(?:New Features|Features|Fonctionnalités)/i },
  { key: 'Improvements', pattern: /^#{2,4}\s*(?:Improvements|Améliorations|Enhancements)/i },
  { key: 'Fixes', pattern: /^#{2,4}\s*(?:Fixes|Bug Fixes|Corrections)/i },
  { key: 'Technical Details', pattern: /^#{2,4}\s*(?:Technical Details|Technical|Technique|Internal)/i },
];

/**
 * Valide le titre et la description
 * @param {string} prTitle 
 * @param {string} prBody 
 */
function validateChangelog(prTitle, prBody) {
  const errors = [];
  const categories = {
    'New Features': [],
    'Improvements': [],
    'Fixes': [],
    'Technical Details': [],
  };

  // 1. Vérification du Titre de la PR
  if (!prTitle || prTitle.length < 8) {
    errors.push("Le titre de la PR est trop court (minimum 8 caractères).");
  } else if (prTitle.endsWith('.')) {
    errors.push("Le titre de la PR ne doit pas se terminer par un point.");
  }

  // 2. Vérification du bypass d'exclusion
  const cleanBodyForBypass = prBody.toLowerCase();
  const isExcluded = cleanBodyForBypass.includes('exclude_from_changelog') || cleanBodyForBypass.includes('ignore_from_changelog');

  if (isExcluded) {
    return {
      status: errors.length === 0 ? 'success' : 'failure',
      isExcluded: true,
      errors,
      categories,
    };
  }

  // 3. Analyse des sections de changelog
  const cleanedBody = stripHtmlComments(prBody);
  const lines = cleanedBody.split('\n');

  let currentCategory = null;
  const categoriesFound = new Set();
  const rawCategoryLines = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Détection d'un titre de section (##, ### ou ####)
    if (line.startsWith('#')) {
      let matchedCategory = null;
      for (const cat of CATEGORY_MAPPINGS) {
        if (cat.pattern.test(line)) {
          matchedCategory = cat.key;
          break;
        }
      }

      if (matchedCategory) {
        currentCategory = matchedCategory;
        categoriesFound.add(currentCategory);
        if (!rawCategoryLines[currentCategory]) {
          rawCategoryLines[currentCategory] = [];
        }
        continue;
      } else if (/^#{2,3}\s*changelog/i.test(line)) {
        // En-tête principal "### Changelog", on attend la sous-catégorie
        currentCategory = null;
        continue;
      } else {
        // Autre section (ex: "### Description")
        currentCategory = null;
        continue;
      }
    }

    if (currentCategory) {
      rawCategoryLines[currentCategory].push(line);
    }
  }

  // 4. Validation des entrées trouvées
  let totalBullets = 0;

  for (const catKey of categoriesFound) {
    const catLines = rawCategoryLines[catKey] || [];
    let bulletsInCat = 0;

    for (const line of catLines) {
      // Vérifier si c'est une puce valide
      const bulletMatch = line.match(/^[-*]\s+(.*)$/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].trim();
        // Vérifier que la puce n'est pas vide ou trop courte
        if (bulletText.length < 8) {
          errors.push(`Dans \`${catKey}\` : la puce "- ${bulletText}" est trop courte (minimum 8 caractères). Expliquez clairement le changement.`);
        } else if (/^(replace with|todo|à compléter|\.\.\.)/i.test(bulletText)) {
          errors.push(`Dans \`${catKey}\` : texte temporaire détecté ("${bulletText}"). Remplissez la description.`);
        } else {
          categories[catKey].push(bulletText);
          bulletsInCat++;
          totalBullets++;
        }
      } else {
        // Texte orphelin sans puce
        errors.push(`Dans \`${catKey}\` : la ligne "${line}" n'est pas une puce valide. Utilisez le format \`- Votre texte\`.`);
      }
    }

    if (bulletsInCat === 0 && catLines.length === 0) {
      errors.push(`La catégorie \`${catKey}\` est présente mais vide. Ajoutez au moins une puce ou supprimez cette section.`);
    }
  }

  // 5. Au moins une catégorie avec au moins une puce
  if (totalBullets === 0) {
    errors.push(
      "Aucune entrée de changelog trouvée. Ajoutez au moins une puce sous `#### New Features`, `#### Improvements` ou `#### Fixes`.\n" +
      "*(Si cette PR ne nécessite pas de changelog, écrivez `exclude_from_changelog` dans la description)*."
    );
  }

  return {
    status: errors.length === 0 ? 'success' : 'failure',
    isExcluded: false,
    errors,
    categories,
  };
}

// Exécution de la validation
const result = validateChangelog(title, body);
const outputPayload = {
  ...result,
  prNumber: prNumber ? Number(prNumber) : null,
  prTitle: title,
  timestamp: new Date().toISOString(),
};

// Écriture du résultat pour le bot GitHub Actions
try {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2), 'utf8');
} catch (err) {
  console.error('[Marvin Linter] Impossible d\'écrire le fichier de résultat:', err);
}

// Affichage console
console.log('\n========================================');
console.log(' 🔍 MARVIN PR CHANGELOG VERIFICATION');
console.log('========================================');
console.log(`Titre : "${title || '(non fourni)'}"`);
if (result.isExcluded) {
  console.log('ℹ️  PR marquée comme exclue du changelog (exclude_from_changelog).');
}

if (result.status === 'success') {
  console.log('✅ Vérification réussie !');
  if (!result.isExcluded) {
    for (const [cat, items] of Object.entries(result.categories)) {
      if (items.length > 0) {
        console.log(`  [${cat}]`);
        items.forEach(item => console.log(`    - ${item}`));
      }
    }
  }
  console.log('========================================\n');
  process.exit(0);
} else {
  console.error('❌ Échec de la vérification :');
  result.errors.forEach(err => console.error(`  - ${err}`));
  console.log('========================================\n');
  process.exit(1);
}
