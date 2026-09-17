/**
 * @fileoverview Outil de consultation de la liste des étudiants inscrits à une séance du planning.
 * Permet de savoir quels camarades de promotion participent à un cours, un kick-off ou une soutenance.
 * @module injected/tools/getEventRegistrations
 * @see {@link https://my.epitech.eu/planning}
 * @endpoint GET /events/:eventId/registrations
 */

import { fetchEpitech } from '../utils/api';
import { getStudentLogin } from '../utils/student';
import { logger } from '../../logger';

/**
 * Arguments de recherche des participants à un événement.
 */
export interface EventRegistrationsArgs {
  /** Identifiant numérique de l'événement. */
  eventId?: number | string;
  /** Nom ou mot-clé de recherche pour identifier automatiquement l'événement. */
  search?: string;
}

/**
 * Récupère la liste nominative des étudiants enregistrés pour une séance spécifique du planning.
 *
 * @param args - Identifiant ou terme de recherche de l'activité.
 * @returns Liste alphabétique des camarades inscrits et statut d'inscription personnel.
 */
export async function getEventRegistrations(args: EventRegistrationsArgs = {}) {
  let eventId = Number(args?.eventId);

  // Détection automatique de l'événement correspondant au mot-clé dans les 14 prochains jours
  if (!eventId && args?.search) {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        registered: 'me'
      });
      const evs = await fetchEpitech<any[]>(`/events?${params.toString()}`);
      if (Array.isArray(evs)) {
        const q = args.search.toLowerCase();
        const found = evs.find(
          (e) =>
            (e.fullTitle && e.fullTitle.toLowerCase().includes(q)) ||
            (e.activityName && e.activityName.toLowerCase().includes(q)) ||
            (e.unitName && e.unitName.toLowerCase().includes(q))
        );
        if (found) eventId = found.id;
      }
    } catch (e) {
      logger.warn("Recherche d'événement par mot-clé échouée :", e);
    }
  }

  if (!eventId) {
    return {
      error: "ID d'événement introuvable. Précisez l'ID ou le nom exact de l'activité."
    };
  }

  try {
    const [eventInfo, regs] = await Promise.all([
      fetchEpitech<any>(`/events/${eventId}`).catch(() => null),
      fetchEpitech<any[]>(`/events/${eventId}/registrations`)
    ]);

    if (!Array.isArray(regs)) {
      return {
        error: 'Impossible de récupérer la liste des inscrits pour cet événement.'
      };
    }

    const myLogin = await getStudentLogin();
    const students = regs
      .map((r) => r.student)
      .filter(Boolean)
      .sort((a, b) => (a.lastname || '').localeCompare(b.lastname || ''));

    const isMeRegistered = students.some((s) => s.login === myLogin);

    return {
      evenement: eventInfo?.fullTitle || eventInfo?.activity?.name || `Événement #${eventId}`,
      totalInscrits: students.length,
      vousEtesInscrit: isMeRegistered,
      etudiantsInscrits: students.slice(0, 60).map((s) => ({
        nomComplet: `${s.firstname} ${s.lastname}`,
        login: s.login,
        promo: s.promotion || undefined
      }))
    };
  } catch (err: any) {
    return {
      error: `Erreur lors de la récupération des inscrits : ${err.message}`
    };
  }
}
