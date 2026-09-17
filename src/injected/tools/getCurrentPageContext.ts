/**
 * @fileoverview Outil de contextualisation de la page actuellement affichée dans le navigateur.
 * Permet au modèle d'adapter ses réponses au contexte de navigation (ex: planning ouvert, fiche projet).
 * @module injected/tools/getCurrentPageContext
 */

/**
 * Récupère les métadonnées de l'onglet actif de l'étudiant (chemin d'accès, paramètres de recherche, titre).
 *
 * @returns Objet décrivant l'URL complète et le titre de la page actuelle.
 */
export async function getCurrentPageContext() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    title: document.title
  };
}
