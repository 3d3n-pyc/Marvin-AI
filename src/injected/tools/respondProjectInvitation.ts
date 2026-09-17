/**
 * @fileoverview Outil de réponse à une invitation de groupe de projet.
 * Permet d'accepter (rejoindre le groupe) ou refuser une invitation en attente.
 * @module injected/tools/respondProjectInvitation
 * @see {@link https://my.epitech.eu/projects}
 * @endpoint POST /units/invitations/:memberId/accept
 * @endpoint DELETE /units/invitations/:memberId
 */

import { fetchEpitech } from '../utils/api';

/**
 * Paramètres pour accepter ou décliner une invitation de projet.
 */
export interface RespondInvitationArgs {
  /** Identifiant unique de l'invitation (fourni par getProjectInvitations). */
  memberId: number | string;
  /** Décision de l'étudiant : 'accept' pour rejoindre le groupe, 'decline' pour refuser. */
  action: 'accept' | 'decline';
}

/**
 * Résultat de l'action de réponse à l'invitation.
 */
export interface RespondInvitationResult {
  /** Indique si l'opération a réussi ou échoué. */
  succes: boolean;
  /** Message de confirmation en cas de succès. */
  message?: string;
  /** Description de l'erreur en cas d'échec. */
  error?: string;
}

/**
 * Accepte ou refuse une invitation à rejoindre une équipe de projet.
 *
 * @param args - Identifiant de l'invitation et action ('accept' | 'decline').
 * @returns Bilan de l'opération avec message explicatif.
 */
export async function respondProjectInvitation(
  args: RespondInvitationArgs
): Promise<RespondInvitationResult> {
  const memberId = Number(args?.memberId);
  const action = args?.action;

  if (!memberId || !action) {
    return {
      succes: false,
      error: "L'identifiant memberId et l'action ('accept' ou 'decline') sont requis."
    };
  }

  try {
    if (action === 'accept') {
      await fetchEpitech(`/units/invitations/${memberId}/accept`, { method: 'POST' });
      return {
        succes: true,
        message: `Invitation #${memberId} acceptée avec succès ! Vous avez rejoint le groupe.`
      };
    } else {
      await fetchEpitech(`/units/invitations/${memberId}`, { method: 'DELETE' });
      return {
        succes: true,
        message: `Invitation #${memberId} refusée.`
      };
    }
  } catch (err: any) {
    return {
      succes: false,
      error: `Impossible de répondre à l'invitation : ${err.message}`
    };
  }
}
