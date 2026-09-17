/**
 * @fileoverview Résolveur de codes et alias pour les modules et unités d'enseignement Epitech.
 * Convertit des libellés vernaculaires ("Innovation Hub", "Anglais", "Web") en codes officiels (ex: "B-INN-000").
 * @module injected/utils/units
 */

import { fetchEpitech } from './api';

/** Cache mémoire associant les variantes textuelles minuscules aux codes officiels en majuscules. */
let cachedUnitMap: Map<string, string> | null = null;

/**
 * Résout une chaîne libre ou un nom usuel de module vers son code d'unité normalisé (ex: "B-INN-000").
 *
 * @param input - Libellé ou code entré par l'étudiant ou le modèle.
 * @returns Le code de l'unité au format conventionnel (ex: "G-ENG-500") ou l'entrée d'origine.
 * @example
 * ```ts
 * await resolveUnitCode("Innovation Hub"); // "B-INN-000"
 * await resolveUnitCode("anglais"); // "G-ENG-500"
 * await resolveUnitCode("G-WEB-500"); // "G-WEB-500"
 * ```
 */
export async function resolveUnitCode(input?: string): Promise<string> {
  if (!input || typeof input !== 'string') return input || '';
  const clean = input.trim();

  // Détection immédiate des codes déjà conformes au gabarit officiel X-XXX-XXX
  if (/^[A-Z]-[A-Z0-9]{2,4}-[0-9]{3}$/i.test(clean)) {
    return clean.toUpperCase();
  }

  if (!cachedUnitMap) {
    cachedUnitMap = new Map();

    // Alias communs français et anglais
    const commonAliases: Record<string, string> = {
      hub: 'B-INN-000',
      'innovation hub': 'B-INN-000',
      anglais: 'G-ENG-500',
      english: 'G-ENG-500',
      web: 'G-WEB-500',
      fullstack: 'G-WEB-500',
      'full stack': 'G-WEB-500',
      devops: 'G-DOP-500',
      cloud: 'G-DOP-500',
      secu: 'G-SEC-500',
      securite: 'G-SEC-500',
      sécurité: 'G-SEC-500',
      cyber: 'G-SEC-500',
      cybersecurite: 'G-SEC-500',
      cybersecurity: 'G-SEC-500',
      aws: 'S-INN-000',
      amazon: 'S-INN-000',
      'google cloud': 'S-INN-002',
      gcp: 'S-INN-002',
      survivor: 'G-SVR-500',
      eip: 'G-EIP-600',
      yep: 'G-YEP-500',
      stage: 'G-PRO-500',
      'practical work': 'G-PRO-500',
      'school life': 'S-ADM-000',
      'vie de lecole': 'S-ADM-000',
      networking: 'S-EPI-000',
      robocar: 'S-ROB-000'
    };

    for (const [alias, code] of Object.entries(commonAliases)) {
      cachedUnitMap.set(alias, code);
    }

    // 1. Indexation depuis la liste complète des instances de l'année scolaire
    try {
      const year = new Date().getFullYear();
      const uRes = await fetchEpitech<any>(`/units/instances?schoolYear=${year}&expanded=false`);
      const uList: any[] = uRes?.data || (Array.isArray(uRes) ? uRes : []);
      for (const u of uList) {
        if (u?.unitCode && u?.name) {
          cachedUnitMap.set(u.name.toLowerCase().trim(), u.unitCode);
          cachedUnitMap.set(u.unitCode.toLowerCase().trim(), u.unitCode);
        }
      }
    } catch {}

    // 2. Indexation depuis la liste des projets
    try {
      const pRes = await fetchEpitech<any>('/units/instances/projects');
      const pList = pRes?.data || (Array.isArray(pRes) ? pRes : []);
      for (const p of pList) {
        const u = p.unitInstance;
        if (u?.unitCode && u?.name) {
          cachedUnitMap.set(u.name.toLowerCase().trim(), u.unitCode);
          cachedUnitMap.set(u.unitCode.toLowerCase().trim(), u.unitCode);
        }
      }
    } catch {}

    // 3. Indexation depuis les événements du calendrier
    try {
      const start = new Date();
      start.setDate(start.getDate() - 14);
      const end = new Date();
      end.setDate(end.getDate() + 30);
      const evs = await fetchEpitech<any[]>(
        `/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}&registered=me`
      );
      if (Array.isArray(evs)) {
        for (const e of evs) {
          if (e.unitCode && e.unitName) {
            cachedUnitMap.set(e.unitName.toLowerCase().trim(), e.unitCode);
            cachedUnitMap.set(e.unitCode.toLowerCase().trim(), e.unitCode);
          }
        }
      }
    } catch {}
  }

  const q = clean.toLowerCase();
  if (cachedUnitMap.has(q)) {
    return cachedUnitMap.get(q)!;
  }

  for (const [name, code] of cachedUnitMap.entries()) {
    if (name.includes(q) || q.includes(name)) {
      return code;
    }
  }

  return clean;
}
