/**
 * @fileoverview Outil d'évaluation des validations académiques et des crédits ECTS.
 * Fournit les crédits acquis, le seuil de passage de l'année, les blocs de compétences et le TEPitech.
 * @module injected/tools/getAcademicValidations
 * @see {@link https://my.epitech.eu/me/academic}
 * @endpoint GET /evaluations/validations/alerts/me
 * @endpoint GET /evaluations/validations/credits/me
 */

import { fetchEpitech } from '../utils/api';

/**
 * Consulte l'état d'avancement académique de l'étudiant (ECTS acquis, seuil requis, certifications).
 *
 * @returns Bilan consolidé des crédits, blocs de compétences et examens d'anglais/TEPitech.
 */
export async function getAcademicValidations() {
  try {
    const [alertsRes, creditsRes] = await Promise.all([
      fetchEpitech<any>('/evaluations/validations/alerts/me').catch(() => null),
      fetchEpitech<any>('/evaluations/validations/credits/me').catch(() => null)
    ]);

    const totalCredits =
      creditsRes?.totalAcquiredCredits ?? alertsRes?.totalAcquiredCredits ?? 0;
    const threshold = alertsRes?.creditsThreshold ?? 0;
    const missingCredits = Math.max(0, threshold - totalCredits);

    const blocks = Array.isArray(alertsRes?.competencyBlocks)
      ? alertsRes.competencyBlocks.map((b: any) => ({
          nom: b.nameFr || b.name,
          seuilCredits: b.threshold,
          creditsSecurises: b.secureCredits,
          creditsAtteignables: b.reachableCredits,
          alerte: b.alertLevel === 'green' ? 'Validé / Conforme' : 'Attention / Insuffisant'
        }))
      : [];

    const certifExams = Array.isArray(alertsRes?.exams)
      ? alertsRes.exams.map((ex: any) => ({
          examen: ex.label,
          scoreRequis: ex.requiredScore,
          meilleurScore: ex.bestScore || 'Aucun score enregistré',
          valide: !!ex.validated,
          statut: ex.validated ? 'Validé' : 'À valider'
        }))
      : [];

    return {
      creditsAcquis: totalCredits,
      seuilPassageAnnee: threshold,
      creditsManquants: missingCredits,
      creditsSecurises: alertsRes?.secureCredits ?? totalCredits,
      creditsPotentiels: alertsRes?.reachableCredits ?? totalCredits,
      statutGlobal:
        alertsRes?.globalAlert === 'green'
          ? 'En bonne voie'
          : 'Alerte crédits / points manquants',
      blocsCompetences: blocks,
      examensCertifiants: certifExams
    };
  } catch (err: any) {
    return {
      error: `Erreur lors de la récupération des validations académiques : ${err.message}`
    };
  }
}
