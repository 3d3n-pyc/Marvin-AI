/**
 * @fileoverview Outil d'analyse du temps de présence sur les machines du campus (Logtime).
 * Calcule les totaux hebdomadaires, l'écart avec la promotion et l'historique sur 14 jours.
 * @module injected/tools/getLogtime
 * @see {@link https://my.epitech.eu/dashboard}
 * @endpoint GET /students/logtime
 */

import { fetchEpitech } from '../utils/api';
import { parseDurationToHours } from '../utils/format';

/**
 * Convertit une chaîne de durée ISO 8601 (ex: "PT418.817S") en secondes entières.
 *
 * @param durationStr - Durée ISO 8601 brute.
 * @returns Durée cumulée en secondes.
 */
function parseDurationToSeconds(durationStr: string | null | undefined): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return 0;
  const hours = parseFloat(match[1] || '0');
  const minutes = parseFloat(match[2] || '0');
  const seconds = parseFloat(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formate un nombre de secondes en notation usuelle Epitech (XhYY, ex: "24h15").
 *
 * @param sec - Durée en secondes.
 * @returns Chaîne formatée en heures et minutes.
 */
function secondsToHoursMinutes(sec: number): string {
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

/**
 * Récupère le relevé de logtime de l'étudiant et compare ses heures avec la moyenne de promotion.
 *
 * @returns Synthèse hebdomadaire et historique détaillé des 14 derniers jours.
 */
export async function getLogtime() {
  try {
    const data = await fetchEpitech<any[]>('/students/logtime');
    if (!Array.isArray(data) || data.length === 0) {
      return { message: 'Aucune donnée de logtime disponible.' };
    }

    // Synthèse sur les 7 derniers jours
    const last7 = data.slice(-7);
    const totalStudentSec7 = last7.reduce(
      (acc, d) => acc + parseDurationToSeconds(d.log_time),
      0
    );
    const totalPromoSec7 = last7.reduce(
      (acc, d) => acc + parseDurationToSeconds(d.promo_log_time),
      0
    );
    const diffSec7 = totalStudentSec7 - totalPromoSec7;

    const diffSign = diffSec7 >= 0 ? '+' : '-';
    const diffFormatted = `${diffSign}${secondsToHoursMinutes(Math.abs(diffSec7))}`;

    // Historique des 14 derniers jours
    const last14 = data.slice(-14).map((d) => {
      const studentSec = parseDurationToSeconds(d.log_time);
      const promoSec = parseDurationToSeconds(d.promo_log_time);
      return {
        date: d.date,
        heures_etudiant: secondsToHoursMinutes(studentSec),
        heures_promo: secondsToHoursMinutes(promoSec),
        heures_decimales_etudiant: parseDurationToHours(d.log_time),
        heures_decimales_promo: parseDurationToHours(d.promo_log_time)
      };
    });

    return {
      syntheseDerniers7Jours: {
        totalEtudiant: secondsToHoursMinutes(totalStudentSec7),
        totalPromo: secondsToHoursMinutes(totalPromoSec7),
        ecartPromo: diffFormatted,
        statutVsPromo:
          diffSec7 >= 0
            ? 'En avance par rapport à la promo'
            : 'En retard par rapport à la promo',
        moyenneJournaliereEtudiant: secondsToHoursMinutes(totalStudentSec7 / 7),
        moyenneJournalierePromo: secondsToHoursMinutes(totalPromoSec7 / 7)
      },
      historique14Jours: last14
    };
  } catch (err: any) {
    return {
      error: `Erreur lors de la récupération du logtime : ${err.message}`
    };
  }
}
