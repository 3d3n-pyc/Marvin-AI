/**
 * @fileoverview Outil d'interrogation des résultats de la moulinette automatique Argos.
 * Fournit le pourcentage de réussite des tests unitaires/fonctionnels, les crashs et les fautes de norme.
 * @module injected/tools/getArgosTests
 * @see {@link https://my.epitech.eu/projects}
 * @endpoint GET /students/test-results
 */

import { fetchEpitech } from '../utils/api';
import { formatLocalDate, formatLocalTime } from '../utils/format';

/**
 * Arguments de recherche des résultats Argos.
 */
export interface ArgosTestsArgs {
  /** Année académique ciblée (ex: 2026, 2025). Par défaut : année courante avec repli automatique. */
  year?: number;
  /** Nom, trigramme ou slug du projet à filtrer (ex: "arcade", "raytracer"). */
  projectQuery?: string;
}

/**
 * Récupère les passages de tests Argos récents et leurs détails d'exécution.
 *
 * @param args - Filtres d'année et de projet.
 * @returns Liste des passages de tests avec détails de couverture et rapport de coding style.
 */
export async function getArgosTests(args: ArgosTestsArgs = {}) {
  const currentYear = new Date().getFullYear();
  const yearToFetch = args.year || currentYear;

  try {
    let res = await fetchEpitech<any>(`/students/test-results?year=${yearToFetch}`);
    let results: any[] = res?.results || (Array.isArray(res) ? res : []);

    // Repli automatique sur l'année N-1 si la promo démarre son année sans passage
    if (results.length === 0 && !args.year) {
      const prevYear = yearToFetch - 1;
      const prevRes = await fetchEpitech<any>(
        `/students/test-results?year=${prevYear}`
      ).catch(() => null);
      if (prevRes?.results && prevRes.results.length > 0) {
        results = prevRes.results;
      }
    }

    if (results.length === 0) {
      return {
        message: "Aucun résultat de moulinette Argos trouvé pour l'année sélectionnée."
      };
    }

    if (args.projectQuery) {
      const q = args.projectQuery.toLowerCase();
      results = results.filter(
        (r) =>
          (r.context?.title && r.context.title.toLowerCase().includes(q)) ||
          (r.context?.projectCode && r.context.projectCode.toLowerCase().includes(q)) ||
          (r.context?.unitCode && r.context.unitCode.toLowerCase().includes(q))
      );
    }

    return results.slice(0, 10).map((run) => {
      const breakdowns = run.skillBreakdowns || {};
      let totalTests = 0;
      let totalPassed = 0;
      let totalCrashed = 0;
      let totalMandatoryFailed = 0;

      const categories = Object.entries(breakdowns).map(([name, stats]: [string, any]) => {
        const count = Number(stats?.count) || 0;
        const passed = Number(stats?.passed) || 0;
        const crashed = Number(stats?.crashed) || 0;
        const mandatoryFailed = Number(stats?.mandatoryFailed) || 0;

        totalTests += count;
        totalPassed += passed;
        totalCrashed += crashed;
        totalMandatoryFailed += mandatoryFailed;

        return {
          categorie: name,
          reussi: `${passed}/${count}`,
          crash: crashed > 0 ? crashed : undefined,
          echecMandatory: mandatoryFailed > 0 ? mandatoryFailed : undefined
        };
      });

      const pourcentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

      const codingStyle = run.codingStyle?.value
        ? {
            fatal: run.codingStyle.value.fatal || 0,
            major: run.codingStyle.value.major || 0,
            minor: run.codingStyle.value.minor || 0,
            info: run.codingStyle.value.info || 0
          }
        : null;

      const dateStr = run.properties?.date
        ? `${formatLocalDate(run.properties.date)} à ${formatLocalTime(run.properties.date)}`
        : 'Date inconnue';

      return {
        id: run.id,
        projet: run.context?.title || run.context?.projectCode,
        module: run.context?.unitCode,
        annee: run.context?.year,
        date: dateStr,
        commit: run.properties?.commit ? run.properties.commit.slice(0, 7) : undefined,
        scoreGlobal: `${pourcentage}% (${totalPassed}/${totalTests} tests réussis)`,
        pourcentageReussite: pourcentage,
        testsCrash: totalCrashed,
        testsMandatoryEchoues: totalMandatoryFailed,
        drapeauxErreurs:
          run.failureFlags && run.failureFlags.length > 0 ? run.failureFlags : undefined,
        normeCodingStyle: codingStyle,
        categories: categories.length > 0 ? categories : undefined
      };
    });
  } catch (err: any) {
    return {
      error: `Erreur lors de la récupération des résultats Argos : ${err.message}`
    };
  }
}
