/**
 * @fileoverview Outil de consultation des absences et du suivi d'assiduité de l'étudiant.
 * Récupère la liste des séances manquées non justifiées et le taux d'absence par projet.
 * @module injected/tools/getAbsences
 * @see {@link https://my.epitech.eu/me/academic}
 * @endpoint GET /events/attendance/activities
 * @endpoint GET /students/absences/projects
 */

import { fetchEpitech } from '../utils/api';
import { formatLocalDate, formatLocalTime } from '../utils/format';

/**
 * Récupère le bilan d'assiduité de l'étudiant (séances manquées et alertes d'exclusion par projet).
 *
 * @returns Bilan synthétique des absences et détail par projet.
 */
export async function getAbsences() {
  try {
    const [activitiesRes, projectsRes] = await Promise.all([
      fetchEpitech<any[]>('/events/attendance/activities').catch(() => []),
      fetchEpitech<any[]>('/students/absences/projects').catch(() => [])
    ]);

    const missedEvents: any[] = Array.isArray(activitiesRes) ? activitiesRes : [];
    const projectAbsences: any[] = Array.isArray(projectsRes) ? projectsRes : [];

    const seancesManquees = missedEvents.map((ev) => ({
      eventId: ev.eventId,
      activite: ev.activityName || ev.eventTitle,
      module: ev.unitName ? `${ev.unitName} (${ev.unitCode})` : ev.unitCode,
      date: formatLocalDate(ev.startDate),
      horaire: `${formatLocalTime(ev.startDate)} - ${formatLocalTime(ev.endDate)}`,
      motifJustificatif: ev.reason || 'Non justifiée'
    }));

    const bilansProjets = projectAbsences.map((p) => {
      const ratioPercent = Math.round((p.absenceRatio || 0) * 100);
      return {
        projet: p.projectName,
        groupe: p.groupName,
        totalSeances: p.trackedEventsCount,
        seancesPresent: p.presentCount,
        seancesAbsent: p.absentCount,
        seancesJustifiees: p.justifiedCount,
        tauxAbsence: `${ratioPercent}%`,
        seuilDepasse: !!p.hasExceededAbsenceThreshold || !!p.tooManyAbsences,
        alerteTropAbsences: p.tooManyAbsences
          ? '⚠️ Seuil d’absence dépassé (risque de défaillance)'
          : 'Conforme'
      };
    });

    return {
      totalSeancesManquees: seancesManquees.length,
      seancesManquees,
      bilanParProjet: bilansProjets
    };
  } catch (err: any) {
    return { error: `Erreur lors de la récupération des absences : ${err.message}` };
  }
}
