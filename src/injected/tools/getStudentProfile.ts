/**
 * @fileoverview Outil de récupération du profil académique officiel de l'étudiant.
 * Fournit les informations d'identité, campus, promotion, cursus, semestre, GPA et statut de scolarité.
 * @module injected/tools/getStudentProfile
 * @see {@link https://my.epitech.eu/profile}
 * @endpoint GET /students/profile
 */

import { fetchEpitech } from '../utils/api';

/**
 * Données d'identité et de scolarité de l'étudiant connecté.
 */
export interface StudentProfileResult {
  /** Identifiant Epitech / login Office 365 (ex: "prenom.nom@epitech.eu"). */
  login: string;
  /** Prénom de l'étudiant. */
  prenom: string;
  /** Nom de famille de l'étudiant. */
  nom: string;
  /** Nom complet du campus d'affectation (ex: "Paris", "Bordeaux"). */
  campus: string;
  /** Code court du campus (ex: "PAR", "BDX"). */
  codeCampus: string;
  /** Nom ou libellé du cursus suivi (ex: "Master PGE", "Pré-MSC"). */
  cursus: string;
  /** Année de promotion de sortie (ex: 2028). */
  promo: number;
  /** Semestre pédagogique actuel (ex: 5, 6). */
  semestre: number;
  /** GPA académique cumulé sous forme de chaîne décimale (ex: "3.42"). */
  gpa: string;
  /** Civilité / genre enregistré. */
  civilite: string;
  /** Indique si l'étudiant est actuellement en situation de redoublement. */
  redoublant: boolean;
}

/**
 * Récupère le profil officiel de l'étudiant depuis l'API MyEpitech.
 *
 * @returns Données de profil détaillées ou objet d'erreur.
 */
export async function getStudentProfile(): Promise<StudentProfileResult | { error: string }> {
  try {
    const p = await fetchEpitech<any>('/students/profile');
    return {
      login: p?.login || '',
      prenom: p?.firstname || '',
      nom: p?.lastname || '',
      campus: p?.campus?.name || '',
      codeCampus: p?.campus?.code || '',
      cursus: p?.cursus?.name || p?.cursus?.code || '',
      promo: p?.promotion || 0,
      semestre: p?.semester || 0,
      gpa: p?.gpa || '0.00',
      civilite: p?.civility || '',
      redoublant: !!p?.isRepeating
    };
  } catch (err: any) {
    return { error: `Impossible de récupérer le profil : ${err.message}` };
  }
}
