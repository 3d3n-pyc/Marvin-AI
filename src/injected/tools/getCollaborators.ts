/**
 * @fileoverview Outil d'analyse du réseau de pairs et des collaborateurs fréquents.
 * Répertorie les camarades avec lesquels l'étudiant a le plus souvent fait équipe et leurs projets communs.
 * @module injected/tools/getCollaborators
 * @see {@link https://my.epitech.eu/dashboard}
 * @endpoint GET /students/collaborators
 */

import { fetchEpitech } from '../utils/api';

/**
 * Récupère le classement des collaborateurs de l'étudiant par fréquence de travail d'équipe.
 *
 * @returns Liste ordonnée des coéquipiers fréquents et de leurs projets partagés.
 */
export async function getCollaborators() {
  try {
    const list = await fetchEpitech<any[]>('/students/collaborators');
    if (!Array.isArray(list)) return [];

    return list.slice(0, 15).map((c) => ({
      nomComplet: `${c.firstname} ${c.lastname}`,
      login: c.login,
      promo: c.promotion,
      nombreProjetsCommuns: c.collaborationCount,
      projetsPartages: Array.isArray(c.sharedProjects)
        ? c.sharedProjects.map((p: any) => `${p.name} (${p.scholarYear})`)
        : []
    }));
  } catch (err: any) {
    return {
      error: `Erreur lors de la récupération des collaborateurs : ${err.message}`
    };
  }
}
