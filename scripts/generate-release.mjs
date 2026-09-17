#!/usr/bin/env node
/**
 * @file generate-release.mjs
 * @description Générateur de release et de CHANGELOG.md automatisé.
 * 
 * Capacités :
 * 1. Détermine la version (bump SemVer: patch/minor/major ou version explicite).
 * 2. Récupère les PRs fusionnées (via API GitHub ou historique Git local).
 * 3. Extrait les catégories de changelog de chaque PR (New Features, Improvements, Fixes, etc.).
 * 4. Met à jour package.json et CHANGELOG.md.
 * 5. Compile et package les archives zip (Chrome & Firefox).
 * 6. Écrit build/release-notes.md pour la GitHub Release.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const bumpType = args.find(a => !a.startsWith('--')) || 'patch';

const PKG_PATH = path.join(process.cwd(), 'package.json');
const CHANGELOG_PATH = path.join(process.cwd(), 'CHANGELOG.md');
const NOTES_PATH = path.join(process.cwd(), 'build/release-notes.md');

// Charger package.json
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const currentVersion = pkg.version;

/**
 * Calcule la nouvelle version SemVer
 * @param {string} current 
 * @param {string} bump 
 * @returns {string}
 */
function computeNextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+.*$/.test(bump)) {
    return bump;
  }
  const parts = current.split('.').map(Number);
  if (parts.length < 3) return '1.0.0';

  if (bump === 'major') {
    return `${parts[0] + 1}.0.0`;
  } else if (bump === 'minor') {
    return `${parts[0]}.${parts[1] + 1}.0`;
  } else {
    // patch par défaut
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

const nextVersion = computeNextVersion(currentVersion, bumpType);

console.log('========================================');
console.log(' 🚀 MARVIN RELEASE GENERATOR');
console.log('========================================');
console.log(`Version actuelle : v${currentVersion}`);
console.log(`Nouvelle version : v${nextVersion} (${bumpType})`);
if (isDryRun) console.log('⚠️  Mode DRY-RUN actif (aucune modification de fichier)');
console.log('========================================\n');

/**
 * Récupère le dernier tag git s'il existe
 */
function getLastTag() {
  try {
    return execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Nettoie les commentaires HTML
 */
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Parse les catégories depuis le corps d'une PR
 */
function parsePRChangelog(body) {
  if (!body) return null;
  const lower = body.toLowerCase();
  if (lower.includes('exclude_from_changelog') || lower.includes('ignore_from_changelog')) {
    return null;
  }

  const CATEGORIES = [
    { key: 'Features', label: '🚀 Nouvelles fonctionnalités', pattern: /^#{2,4}\s*(?:New Features|Features|Fonctionnalités)/i },
    { key: 'Improvements', label: '⚡ Améliorations', pattern: /^#{2,4}\s*(?:Improvements|Améliorations|Enhancements)/i },
    { key: 'Fixes', label: '🐛 Corrections de bugs', pattern: /^#{2,4}\s*(?:Fixes|Bug Fixes|Corrections)/i },
    { key: 'Technical', label: '🛠️ Détails techniques', pattern: /^#{2,4}\s*(?:Technical Details|Technical|Technique|Internal)/i },
  ];

  const cleaned = stripHtmlComments(body);
  const lines = cleaned.split('\n');
  const result = {};

  let currentKey = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#')) {
      const match = CATEGORIES.find(c => c.pattern.test(trimmed));
      currentKey = match ? match.key : null;
      continue;
    }

    if (currentKey) {
      const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
      if (bulletMatch) {
        const text = bulletMatch[1].trim();
        if (text.length > 5 && !/^(replace with|todo)/i.test(text)) {
          if (!result[currentKey]) result[currentKey] = [];
          result[currentKey].push(text);
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Récupère les PRs fusionnées
 */
async function fetchMergedPRs() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (token && repo) {
    console.log(`[Release] Récupération des PRs via l'API GitHub (${repo})...`);
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=closed&per_page=100`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Marvin-Release-Generator'
        }
      });
      if (res.ok) {
        const prs = await res.json();
        // Filtrer celles qui ont été mergées
        return prs
          .filter(pr => pr.merged_at)
          .map(pr => ({
            number: pr.number,
            title: pr.title,
            body: pr.body || '',
            author: pr.user?.login || 'unknown',
            htmlUrl: pr.html_url,
          }));
      }
    } catch (err) {
      console.warn('[Release] Erreur lors de l\'appel API GitHub :', err.message);
    }
  }

  // Fallback local Git : analyse des commits
  console.log('[Release] Analyse de l\'historique Git local...');
  const prs = [];

  try {
    execSync('git rev-parse --verify HEAD', { stdio: 'ignore' });
  } catch {
    console.log('[Release] Dépôt Git initial (aucun commit HEAD pour l\'instant).');
    return prs;
  }

  const lastTag = getLastTag();
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';

  try {
    const gitLog = execSync(`git log ${range} --oneline`, { encoding: 'utf8' });
    const lines = gitLog.split('\n').filter(Boolean);

    for (const line of lines) {
      // Détection de squash merges "Title (#12)" ou merge commits "Merge pull request #12"
      const match = line.match(/(?:#(\d+)|pull request #(\d+))/);
      if (match) {
        const prNumber = match[1] || match[2];
        // Récupérer le commit body complet
        const fullMsg = execSync(`git log -1 --format=%B --grep="#${prNumber}"`, { encoding: 'utf8' });
        prs.push({
          number: Number(prNumber),
          title: line.replace(/^[a-f0-9]+\s+/, ''),
          body: fullMsg,
          author: 'contributor',
          htmlUrl: `#${prNumber}`,
        });
      }
    }
  } catch (err) {
    console.warn('[Release] Aucune PR détectée via git log :', err.message);
  }

  return prs;
}

async function run() {
  const prList = await fetchMergedPRs();
  console.log(`[Release] ${prList.length} PR(s) analysée(s).`);

  const categorized = {
    Features: [],
    Improvements: [],
    Fixes: [],
    Technical: [],
  };

  const contributors = new Set();

  for (const pr of prList) {
    const parsed = parsePRChangelog(pr.body);
    if (parsed) {
      if (pr.author && pr.author !== 'unknown') contributors.add(`@${pr.author}`);
      for (const [key, items] of Object.entries(parsed)) {
        if (categorized[key]) {
          for (const item of items) {
            categorized[key].push(`${item} ([#${pr.number}](${pr.htmlUrl}) par @${pr.author})`);
          }
        }
      }
    }
  }

  // Construction de la note de release
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
  let releaseMarkdown = `## [v${nextVersion}] - ${today}\n\n`;

  const SECTIONS = [
    { key: 'Features', title: '🚀 Nouvelles fonctionnalités' },
    { key: 'Improvements', title: '⚡ Améliorations' },
    { key: 'Fixes', title: '🐛 Corrections de bugs' },
    { key: 'Technical', title: '🛠️ Détails techniques' },
  ];

  let hasEntries = false;
  for (const sec of SECTIONS) {
    const items = categorized[sec.key];
    if (items && items.length > 0) {
      hasEntries = true;
      releaseMarkdown += `### ${sec.title}\n`;
      items.forEach(i => releaseMarkdown += `- ${i}\n`);
      releaseMarkdown += '\n';
    }
  }

  if (!hasEntries) {
    releaseMarkdown += `- Mises à jour de maintenance et optimisations diverses.\n\n`;
  }

  if (contributors.size > 0) {
    releaseMarkdown += `### 👥 Contributeurs\nMerci à ${Array.from(contributors).join(', ')} pour leurs contributions !\n\n`;
  }

  console.log('--- Aperçu des Release Notes ---');
  console.log(releaseMarkdown.trim());
  console.log('--------------------------------\n');

  if (isDryRun) {
    console.log('✨ Terminé en mode Dry-Run.');
    return;
  }

  // 1. Sauvegarde release-notes.md pour GitHub Actions
  fs.mkdirSync('build', { recursive: true });
  fs.writeFileSync(NOTES_PATH, releaseMarkdown.trim(), 'utf8');

  // 2. Mise à jour CHANGELOG.md
  let currentChangelog = '';
  if (fs.existsSync(CHANGELOG_PATH)) {
    currentChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  } else {
    currentChangelog = '# Changelog\n\nToutes les modifications notables de ce projet sont consignées dans ce document.\n\n';
  }

  // Insérer après le titre principal
  const changelogHeader = '# Changelog\n\nToutes les modifications notables de ce projet sont consignées dans ce document.\n\n';
  let updatedChangelog = '';
  if (currentChangelog.startsWith('# Changelog')) {
    const rest = currentChangelog.replace(/^# Changelog[^\n]*\n+([^\n]*\n+)?/, '');
    updatedChangelog = `${changelogHeader}${releaseMarkdown}${rest}`;
  } else {
    updatedChangelog = `${changelogHeader}${releaseMarkdown}${currentChangelog}`;
  }
  fs.writeFileSync(CHANGELOG_PATH, updatedChangelog, 'utf8');
  console.log(`✅ CHANGELOG.md mis à jour avec v${nextVersion}.`);

  // 3. Mise à jour package.json
  pkg.version = nextVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`✅ package.json mis à jour vers v${nextVersion}.`);

  // 4. Exécution du build pour propager la version aux manifests et bundles
  console.log('[Release] Compilation des bundles de production...');
  execSync('npm run build', { stdio: 'inherit' });

  // 5. Création des archives zip prêtes au déploiement
  fs.mkdirSync('dist/releases', { recursive: true });
  const chromeZip = `dist/releases/marvin-ai-chrome-v${nextVersion}.zip`;
  const firefoxZip = `dist/releases/marvin-ai-firefox-v${nextVersion}.zip`;

  try {
    execSync(`cd dist/chrome && zip -q -r "../../${chromeZip}" .`, { stdio: 'inherit' });
    execSync(`cd dist/firefox && zip -q -r "../../${firefoxZip}" .`, { stdio: 'inherit' });
    console.log(`✅ Archives générées :`);
    console.log(`   📦 Chrome  : ${chromeZip}`);
    console.log(`   🦊 Firefox : ${firefoxZip}`);
  } catch (err) {
    console.warn('[Release] Erreur lors de la création des archives zip :', err.message);
  }

  console.log(`\n🎉 Release v${nextVersion} prête avec succès !`);
}

run().catch(err => {
  console.error('[Release] Erreur :', err);
  process.exit(1);
});
