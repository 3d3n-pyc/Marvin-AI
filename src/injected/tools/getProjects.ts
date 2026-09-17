/**
 * @fileoverview Outil d'exploration des projets de l'étudiant.
 * Récupère les projets en cours, dates de rendu, jours restants, groupes et liens Hermes.
 * @module injected/tools/getProjects
 * @see {@link https://my.epitech.eu/projects}
 * @endpoint GET /units/instances/projects
 */

import { fetchEpitech } from '../utils/api';
import { formatLocalDate } from '../utils/format';

/**
 * Critères de filtrage pour la liste des projets.
 */
export interface ProjectsArgs {
  /** Filtrer par statut : 'ongoing' (en cours uniquement) ou 'all' (tous). Défaut : 'ongoing'. */
  status?: 'ongoing' | 'all';
  /** Restreindre aux projets auxquels l'étudiant est formellement inscrit. Défaut : true. */
  registeredOnly?: boolean;
}

/**
 * Informations sur le groupe de travail de l'étudiant pour un projet.
 */
export interface ProjectGroupInfo {
  /** Identifiant unique de l'inscription / du groupe. */
  id: number | string;
  /** Nom du groupe (ex: "Groupe 4" ou nom personnalisé). */
  nomGroupe: string;
  /** Nombre de membres actuellement dans le groupe. */
  nombreMembres: number;
}

/**
 * Représentation synthétique et contextualisée d'un projet étudiant.
 */
export interface FormattedProject {
  /** Identifiant unique du projet. */
  id: number | string;
  /** Nom complet du projet (ex: "Dashboard"). */
  nom: string;
  /** Nom du module associé avec son code officiel (ex: "Full-Stack Web Development (G-WEB-500)"). */
  module: string;
  /** Date de début au format local. */
  debut: string;
  /** Date de fin / deadline au format local. */
  fin: string;
  /** Compte à rebours textuel (ex: "5 jour(s) restant(s)" ou "Projet terminé"). */
  joursRestants: string;
  /** Date limite d'inscription ou composition de groupe si définie. */
  dateLimiteInscription: string | null;
  /** Taille autorisée pour les groupes (ex: "2" ou "2 à 4"). */
  tailleGroupe: string;
  /** Indique si l'étudiant est formellement inscrit au projet. */
  estInscrit: boolean;
  /** Détails du groupe de l'étudiant si formé. */
  monGroupe: ProjectGroupInfo | null;
  /** URL d'accès direct au sujet et aux consignes sur Hermes. */
  hermesUrl?: string;
}

/**
 * Récupère les projets de l'étudiant avec leurs échéances et données de groupe.
 *
 * @param args - Critères de filtrage (statut, inscription).
 * @returns Liste des projets formatés ou objet d'erreur.
 */
export async function getProjects(
  args: ProjectsArgs = {}
): Promise<FormattedProject[] | { error: string }> {
  const status = args.status || 'ongoing';
  const registeredOnly = args.registeredOnly !== false;

  const params = new URLSearchParams({
    page: '1',
    limit: '50'
  });
  if (status !== 'all') {
    params.set('status', status);
  }
  if (registeredOnly) {
    params.set('registeredOnly', 'true');
  }

  try {
    const res = await fetchEpitech<any>(`/units/instances/projects?${params.toString()}`);
    const list: any[] = res?.data || (Array.isArray(res) ? res : []);

    const now = Date.now();

    return list.map((p) => {
      const endMs = p.endDate ? new Date(p.endDate).getTime() : 0;
      const daysRemaining = endMs > now ? Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)) : 0;

      const myReg = Array.isArray(p.registrations) && p.registrations.length > 0 ? p.registrations[0] : null;

      return {
        id: p.id,
        nom: p.fullName || p.name,
        module: p.unitInstance?.name ? `${p.unitInstance.name} (${p.unitInstance.unitCode})` : (p.unitInstance?.unitCode || ''),
        debut: formatLocalDate(p.startDate),
        fin: formatLocalDate(p.endDate),
        joursRestants: daysRemaining > 0 ? `${daysRemaining} jour(s) restant(s)` : 'Projet terminé',
        dateLimiteInscription: p.endRegistrationDate ? formatLocalDate(p.endRegistrationDate) : null,
        tailleGroupe: p.groupSizeMin === p.groupSizeMax ? `${p.groupSizeMin}` : `${p.groupSizeMin} à ${p.groupSizeMax}`,
        estInscrit: !!p.isUserRegistered,
        monGroupe: myReg ? {
          id: myReg.id,
          nomGroupe: myReg.groupName,
          nombreMembres: Array.isArray(myReg.members) ? myReg.members.length : 1
        } : null,
        hermesUrl: p.hermesActivityUrl || undefined
      };
    });
  } catch (err: any) {
    return { error: `Erreur lors de la récupération des projets : ${err.message}` };
  }
}
