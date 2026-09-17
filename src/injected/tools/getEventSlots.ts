/**
 * @fileoverview Outil de consultation des créneaux de passage (slots) d'un événement.
 * Détermine l'ordre chronologique de passage, le créneau individuel de l'étudiant
 * et l'identité des camarades qui passent juste avant ou juste après lui.
 * @module injected/tools/getEventSlots
 * @see {@link https://my.epitech.eu/planning}
 * @endpoint GET /events/:eventId/slots
 */

import { fetchEpitech } from '../utils/api';
import { formatLocalTime } from '../utils/format';
import { getStudentLogin } from '../utils/student';

/**
 * Arguments pour consulter les créneaux d'un événement.
 */
export interface EventSlotsArgs {
  /** Identifiant numérique de l'événement. Détecté automatiquement depuis l'URL si omis. */
  eventId?: number | string;
}

/**
 * Récupère les créneaux de rendez-vous d'une soutenance ou d'un suivi individuel.
 *
 * @param args - Identifiant optionnel de l'événement.
 * @returns Liste ordonnée des créneaux, créneau personnel et passage adjacent.
 */
export async function getEventSlots(args: EventSlotsArgs = {}) {
  let eventId = Number(args?.eventId);

  // 1. Détection automatique depuis l'URL de la page active (?eventId=22394)
  if (!eventId && typeof window !== 'undefined') {
    try {
      const sp = new URLSearchParams(window.location.search);
      const qId = sp.get('eventId');
      if (qId) eventId = Number(qId);
    } catch {}
  }

  // 2. Détection automatique depuis l'activité à créneaux d'aujourd'hui dans le planning
  if (!eventId) {
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      const evs = await fetchEpitech<any[]>(
        `/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}&registered=me`
      );
      if (Array.isArray(evs)) {
        const slotEv = evs.find((e) => e.activitySlotsEnabled || e.mySlotStartDate);
        if (slotEv?.id) eventId = slotEv.id;
      }
    } catch {}
  }

  if (!eventId) {
    return {
      error:
        "ID d'événement introuvable. Spécifiez l'ID de l'événement ou ouvrez l'événement sur votre planning."
    };
  }

  try {
    const [eventInfo, slots] = await Promise.all([
      fetchEpitech<any>(`/events/${eventId}`).catch(() => null),
      fetchEpitech<any[]>(`/events/${eventId}/slots`)
    ]);

    if (!Array.isArray(slots)) {
      return { error: `Aucun créneau trouvé pour l'événement #${eventId}.` };
    }

    const myLogin = await getStudentLogin();

    // Tri chronologique des créneaux de passage
    const sortedSlots = [...slots].sort(
      (a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime()
    );

    const mappedSlots = sortedSlots.map((s, index) => {
      const reg = s.registration;
      const isMine =
        reg?.student?.login === myLogin ||
        reg?.registeredStudents?.some((st: any) => st.login === myLogin);

      const studentName = isMine
        ? 'Vous-même'
        : reg?.student
          ? `${reg.student.firstname} ${reg.student.lastname}`
          : reg?.registeredStudents?.length
            ? reg.registeredStudents
                .map((st: any) => `${st.firstname} ${st.lastname}`)
                .join(', ')
            : 'Créneau libre';

      return {
        numeroOrdre: index + 1,
        horaire: `${formatLocalTime(s.startDate)} - ${formatLocalTime(s.endDate)}`,
        heure_debut: formatLocalTime(s.startDate),
        heure_fin: formatLocalTime(s.endDate),
        etudiant: studentName,
        estReserve: !!reg,
        estMonCreneau: isMine
      };
    });

    const myIndex = mappedSlots.findIndex((s) => s.estMonCreneau);

    return {
      evenement: eventInfo?.fullTitle || eventInfo?.activityName || `Événement #${eventId}`,
      eventId,
      totalCreneaux: mappedSlots.length,
      monCreneau: myIndex >= 0 ? mappedSlots[myIndex] : null,
      quiPasseJusteAvantMoi: myIndex > 0 ? mappedSlots[myIndex - 1] : null,
      quiPasseJusteApresMoi:
        myIndex >= 0 && myIndex < mappedSlots.length - 1
          ? mappedSlots[myIndex + 1]
          : null,
      ordreCompletDePassage: mappedSlots
    };
  } catch (err: any) {
    return {
      error: `Erreur lors de la récupération des créneaux : ${err.message}`
    };
  }
}
