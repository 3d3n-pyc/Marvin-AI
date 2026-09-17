/**
 * @fileoverview Outil de suivi de la gamification étudiante sur MyEpitech.
 * Récupère le solde de points d'expérience (XP), le niveau, la série de jours consécutifs (streak) et les vies.
 * @module injected/tools/getGamification
 * @see {@link https://my.epitech.eu/dashboard}
 * @endpoint GET /gamification/xp/me
 * @endpoint GET /gamification/streak/me
 */

import { fetchEpitech } from '../utils/api';

/**
 * Récupère le profil de gamification de l'étudiant connecté.
 *
 * @returns Données de progression (XP, niveau, série de connexion en jours, vies de secours).
 */
export async function getGamification() {
  try {
    const [xp, streak] = await Promise.all([
      fetchEpitech<any>('/gamification/xp/me').catch(() => null),
      fetchEpitech<any>('/gamification/streak/me').catch(() => null)
    ]);

    return {
      niveau: xp?.level ?? 0,
      totalXp: xp?.totalXp ?? 0,
      xpNiveauActuel: xp?.xpInLevel ?? 0,
      xpPourProchainNiveau: xp?.xpToNext ?? 0,
      serieActuelleJours: streak?.currentCount ?? 0,
      meilleureSerieJours: streak?.longestCount ?? 0,
      viesSauvegardeRestantes: streak?.savesAvailable ?? 0,
      activiteRequiseAujourdhui: !!streak?.requiresActivityToday
    };
  } catch (err: any) {
    return {
      error: `Erreur lors de la récupération des données de gamification : ${err.message}`
    };
  }
}
