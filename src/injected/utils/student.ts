/**
 * @fileoverview Gestionnaire d'identité et de session de l'étudiant connecté.
 * @module injected/utils/student
 */

import { fetchEpitech, getEpitechToken } from './api';

/** Cache mémoire pour éviter de re-décoder le JWT à chaque appel. */
let cachedLogin: string | null = null;

/**
 * Récupère le login officiel (adresse e-mail Epitech) de l'étudiant connecté.
 * Tente d'abord de décoder le payload JWT local, puis interroge `/students/profile` en repli.
 *
 * @returns Le login Epitech (ex: "maxime1.lefevre@epitech.eu") ou `null` si introuvable.
 */
export async function getStudentLogin(): Promise<string | null> {
  if (cachedLogin) return cachedLogin;

  try {
    const token = getEpitechToken();
    if (token) {
      const parts = token.split('.');
      if (parts[1]) {
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
        const login = payload.login || payload.email || payload.upn || payload.sub;
        if (login) {
          cachedLogin = login;
          return cachedLogin;
        }
      }
    }
  } catch {}

  try {
    const p = await fetchEpitech<{ login?: string }>('/students/profile');
    if (p?.login) {
      cachedLogin = p.login;
      return cachedLogin;
    }
  } catch {}

  return null;
}
