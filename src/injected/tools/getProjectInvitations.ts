/**
 * @fileoverview Outil de consultation des invitations en attente pour les groupes de projet.
 * Permet à l'étudiant de voir quelles équipes l'invitent à collaborer.
 * @module injected/tools/getProjectInvitations
 * @see {@link https://my.epitech.eu/projects}
 * @endpoint GET /units/projects/registrations/invitations/me
 */

import { fetchEpitech } from '../utils/api';

/**
 * Représentation structurée d'une invitation à rejoindre un groupe de projet.
 */
export interface FormattedProjectInvitation {
  /** Identifiant unique de l'invitation (memberId). */
  memberId: number | string;
  /** Statut actuel de l'invitation (ex: "pending"). */
  statut: string;
  /** Nom du groupe invitant. */
  groupe: string;
  /** Nom du projet associé. */
  projet: string;
  /** Prénom et nom du chef de groupe ayant émis ou validé l'invitation. */
  responsableGroupe: string;
  /** Instruction d'appel pour accepter l'invitation avec Marvin. */
  actionAccepter: string;
  /** Instruction d'appel pour refuser l'invitation avec Marvin. */
  actionRefuser: string;
}

/**
 * Consulte les invitations en attente reçues par l'étudiant pour rejoindre un groupe de projet.
 *
 * @returns Liste des invitations formatées, message d'absence d'invitation ou objet d'erreur.
 */
export async function getProjectInvitations(): Promise<
  FormattedProjectInvitation[] | { message: string } | { error: string }
> {
  try {
    const list = await fetchEpitech<any[]>('/units/projects/registrations/invitations/me');
    if (!Array.isArray(list) || list.length === 0) {
      return { message: 'Aucune invitation de projet en attente.' };
    }

    return list.map((inv) => ({
      memberId: inv.id,
      statut: inv.status,
      groupe: inv.registration?.groupName || 'Groupe sans nom',
      projet: inv.registration?.projectInstance?.name || 'Projet',
      responsableGroupe: inv.registration?.leader
        ? `${inv.registration.leader.firstname} ${inv.registration.leader.lastname}`
        : 'Inconnu',
      actionAccepter: `Utilisez respondProjectInvitation avec memberId: ${inv.id} et action: "accept"`,
      actionRefuser: `Utilisez respondProjectInvitation avec memberId: ${inv.id} et action: "decline"`
    }));
  } catch (err: any) {
    return { error: `Erreur lors de la récupération des invitations : ${err.message}` };
  }
}
