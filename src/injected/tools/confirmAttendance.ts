/**
 * @fileoverview Outil de validation de la présence (émargement) à un événement du planning.
 * Envoie le code numérique fourni par le professeur ou le responsable de séance.
 * @module injected/tools/confirmAttendance
 * @see {@link https://my.epitech.eu/planning}
 * @endpoint POST /events/:eventId/attendance/confirm
 */

import { fetchEpitech } from '../utils/api';
import { logger } from '../../logger';

/**
 * Paramètres attendus pour valider l'émargement.
 */
export interface ConfirmAttendanceArgs {
  /** Code numérique de validation à 4 chiffres fourni par l'intervenant (ex: "4821"). */
  code: string;
  /** Identifiant numérique de l'événement. Si omis, l'événement actif est recherché automatiquement. */
  eventId?: number | string;
}

/**
 * Valide la présence de l'étudiant à une séance en cours.
 *
 * @param args - Arguments contenant le code et optionnellement l'ID de l'événement.
 * @returns Résultat de l'opération (succès ou message d'erreur).
 */
export async function confirmAttendance(args: ConfirmAttendanceArgs) {
  const code = String(args?.code || '').trim();
  if (!code) {
    return { error: 'Le code de présence est requis (ex: "4821").' };
  }

  let eventId = Number(args?.eventId);

  // Détection automatique de l'événement actif du jour si aucun identifiant n'est fourni
  if (!eventId) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const params = new URLSearchParams({
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
        registered: 'me'
      });

      const todayEvents = await fetchEpitech<any[]>(`/events?${params.toString()}`);
      if (Array.isArray(todayEvents) && todayEvents.length > 0) {
        // Priorité 1 : événement dont l'émargement est ouvert
        const openEvent = todayEvents.find((e) => e.attendanceOpen || e.attendanceActive);
        if (openEvent) {
          eventId = openEvent.id;
        } else {
          // Priorité 2 : événement en cours à l'heure actuelle (+/- marge)
          const currentMs = now.getTime();
          const ongoing = todayEvents.find((e) => {
            const s = new Date(e.startDate).getTime();
            const end = new Date(e.endDate).getTime();
            return currentMs >= s - 15 * 60 * 1000 && currentMs <= end + 30 * 60 * 1000;
          });
          if (ongoing) {
            eventId = ongoing.id;
          } else {
            eventId = todayEvents[0].id;
          }
        }
      }
    } catch (e) {
      logger.warn("Recherche automatique de l'événement du jour échouée :", e);
    }
  }

  if (!eventId) {
    return {
      error: "Impossible d'identifier l'événement du planning en cours. Veuillez préciser l'ID de l'événement."
    };
  }

  try {
    await fetchEpitech(`/events/${eventId}/attendance/confirm`, {
      method: 'POST',
      body: { code }
    });

    return {
      succes: true,
      message: `Présence validée avec succès avec le code "${code}" pour l'événement #${eventId} !`,
      eventId,
      codeUtilise: code
    };
  } catch (err: any) {
    return {
      succes: false,
      error: `Échec de validation de présence pour l'événement #${eventId} : ${err.message}`
    };
  }
}
