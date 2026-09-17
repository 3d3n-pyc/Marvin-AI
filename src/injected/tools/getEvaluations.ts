/**
 * @fileoverview Outil de consultation des évaluations, soutenances, notes et retours des jurys.
 * Interroge les grilles d'évaluation détaillées par critères ainsi que les notes chiffrées officielles.
 * @module injected/tools/getEvaluations
 * @see {@link https://my.epitech.eu/me/academic}
 * @endpoint GET /students/evaluations
 * @endpoint GET /students/evaluations/marks
 */

import { fetchEpitech } from '../utils/api';
import { formatLocalDate } from '../utils/format';

/**
 * Arguments de recherche des évaluations.
 */
export interface EvaluationsArgs {
  /** Nombre maximum d'évaluations et de notes à renvoyer (par défaut : 20). */
  limit?: number;
}

/**
 * Récupère l'historique des soutenances et des notes de l'étudiant avec commentaires des évaluateurs.
 *
 * @param args - Limite de résultats souhaitée.
 * @returns Bilan consolidé des soutenances par critères et des notes chiffrées.
 */
export async function getEvaluations(args: EvaluationsArgs = {}) {
  const max = args.limit || 20;

  try {
    const [evalsRes, marksRes] = await Promise.all([
      fetchEpitech<any>('/students/evaluations?page=1&limit=50').catch(() => null),
      fetchEpitech<any[]>('/students/evaluations/marks').catch(() => [])
    ]);

    const assessments: any[] = evalsRes?.data || (Array.isArray(evalsRes) ? evalsRes : []);
    const rawMarks: any[] = Array.isArray(marksRes) ? marksRes : [];

    // Formatage des grilles de soutenances détaillées par compétences
    const formattedAssessments = assessments.slice(0, max).map((ev) => {
      const criteria = Array.isArray(ev.assessments)
        ? ev.assessments.map((a: any) => ({
            critere: a.achievement?.title || 'Critère',
            note: a.finalMark ?? a.mark,
            noteMax: Array.isArray(a.achievement?.markValues)
              ? Math.max(...a.achievement.markValues)
              : undefined,
            remarque: a.individualComment || a.groupComment || undefined
          }))
        : [];

      return {
        type: 'evaluation_soutenance',
        titre: ev.title,
        date: formatLocalDate(ev.date),
        evaluateur: ev.evaluator || undefined,
        commentaireGeneral: ev.comment || undefined,
        criteresDetails: criteria.length > 0 ? criteria : undefined
      };
    });

    // Formatage des notes chiffrées officielles (/20)
    const formattedMarks = rawMarks.slice(0, max).map((m) => ({
      type: 'note_chiffree',
      activite: m.activityTitle || m.title || 'Activité',
      note: m.mark,
      date: formatLocalDate(m.date),
      evaluateur: m.evaluator || undefined,
      commentaire: m.comment || undefined,
      evenement: m.eventTitle || undefined
    }));

    return {
      totalEvaluations: formattedAssessments.length,
      totalNotesChiffrees: formattedMarks.length,
      evaluationsSoutenances: formattedAssessments,
      notesOfficielles: formattedMarks
    };
  } catch (err: any) {
    return {
      error: `Erreur lors de la récupération des notes et évaluations : ${err.message}`
    };
  }
}
