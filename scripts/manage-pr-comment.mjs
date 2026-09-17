#!/usr/bin/env node
/**
 * @file manage-pr-comment.mjs
 * @description Gère l'affichage persistant du statut de changelog sur les PRs GitHub.
 * Utilise l'API GitHub native sans dépendance externe (compatible Node 20+ fetch).
 * 
 * - Si échec : poste ou met à jour le commentaire d'erreur et applique le label "Wrong Title/Changelog".
 * - Si succès : si un commentaire d'erreur existait, il est archivé/plié (<details>) et le label est retiré.
 */

import fs from 'node:fs';
import path from 'node:path';

const RESULT_FILE = process.argv[2] || 'build/changelog-result.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY; // "owner/repo"

const COMMENT_MARKER = '<!-- changelog-check-review -->';
const COMMENT_MARKER_STALE = '<!-- changelog-check-review-stale -->';
const LABEL_NAME = 'Wrong Title/Changelog';

async function main() {
  if (!fs.existsSync(RESULT_FILE)) {
    console.error(`[Marvin Bot] Fichier de résultat introuvable : ${RESULT_FILE}`);
    process.exit(1);
  }

  const result = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
  const prNumber = result.prNumber || process.env.PR_NUMBER;

  if (!prNumber) {
    console.error('[Marvin Bot] Numéro de PR manquant dans le résultat et dans PR_NUMBER.');
    process.exit(1);
  }

  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    console.log('[Marvin Bot] Mode hors-CI détecté (GITHUB_TOKEN ou GITHUB_REPOSITORY absent). Simulation locale.');
    console.log(`PR: #${prNumber} | Status: ${result.status}`);
    return;
  }

  const apiBase = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'User-Agent': 'Marvin-Changelog-Bot',
  };

  /**
   * Effectue un appel API GitHub
   */
  async function ghFetch(endpoint, options = {}) {
    const res = await fetch(`${apiBase}${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    if (!res.ok && res.status !== 404) {
      const errorText = await res.text();
      console.warn(`[Marvin Bot] GitHub API [${res.status}] ${endpoint}: ${errorText}`);
    }
    return res;
  }

  // 1. Récupérer les commentaires existants de la PR
  const commentsRes = await ghFetch(`/issues/${prNumber}/comments?per_page=100`);
  const comments = commentsRes.ok ? await commentsRes.json() : [];

  const existingErrorComment = comments.find(c => c.body && c.body.includes(COMMENT_MARKER));
  const existingStaleComment = comments.find(c => c.body && c.body.includes(COMMENT_MARKER_STALE));

  // 2. Traitement selon le statut
  if (result.status === 'failure') {
    const errorItems = result.errors.map(e => `* ${e}`).join('\n');
    const commentBody = `${COMMENT_MARKER}
### ⚠️ Vérification du Changelog échouée

Merci pour votre Pull Request ! Avant de pouvoir fusionner, merci de corriger les éléments suivants :

#### 📋 Problèmes détectés :
${errorItems}

---
💡 **Comment corriger ?**
- Modifiez directement le **titre** ou la **description** de votre PR sur GitHub.
- Si cette PR ne nécessite pas de changelog (ex: doc, CI, refactor interne), ajoutez simplement \`exclude_from_changelog\` dans votre description.
`;

    if (existingErrorComment) {
      console.log(`[Marvin Bot] Mise à jour du commentaire d'erreur existant #${existingErrorComment.id}...`);
      await ghFetch(`/issues/${prNumber}/comments/${existingErrorComment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: commentBody }),
      });
    } else {
      console.log('[Marvin Bot] Création d\'un nouveau commentaire d\'erreur...');
      await ghFetch(`/issues/${prNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody }),
      });
    }

    // Ajout du label
    console.log(`[Marvin Bot] Application du label "${LABEL_NAME}"...`);
    await ghFetch(`/issues/${prNumber}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labels: [LABEL_NAME] }),
    });

  } else {
    // Succès
    if (existingErrorComment) {
      console.log(`[Marvin Bot] Changement du commentaire #${existingErrorComment.id} en statut résolu (stale)...`);
      const oldErrors = existingErrorComment.body.replace(COMMENT_MARKER, '').trim();
      const resolvedBody = `${COMMENT_MARKER_STALE}
### ✅ Changelog validé avec succès !

<details>
<summary>Historique des erreurs résolues</summary>

${oldErrors}

</details>
`;

      await ghFetch(`/issues/${prNumber}/comments/${existingErrorComment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: resolvedBody }),
      });
    }

    // Retrait du label s'il était présent
    console.log(`[Marvin Bot] Retrait du label "${LABEL_NAME}" si présent...`);
    await ghFetch(`/issues/${prNumber}/labels/${encodeURIComponent(LABEL_NAME)}`, {
      method: 'DELETE',
    });
  }

  console.log('[Marvin Bot] Opération terminée avec succès.');
}

main().catch(err => {
  console.error('[Marvin Bot] Erreur fatale :', err);
  process.exit(1);
});
