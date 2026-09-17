/**
 * @fileoverview Outil de consultation des notifications récentes de l'étudiant.
 * Récupère le fil d'actualité MyEpitech (résultats d'évaluation, changements de salle, invitations de groupe).
 * @module injected/tools/getNotifications
 * @see {@link https://my.epitech.eu/notifications}
 * @endpoint GET /notifications/feed
 */

import { fetchEpitech } from '../utils/api';
import { formatLocalDate, formatLocalTime } from '../utils/format';

/**
 * Paramètres optionnels pour le filtrage des notifications.
 */
export interface NotificationsArgs {
  /** Nombre maximal de notifications à retourner (défaut : 20). */
  limit?: number;
}

/**
 * Représentation simplifiée et contextualisée d'une notification.
 */
export interface FormattedNotification {
  /** Identifiant unique de la notification. */
  id: string | number;
  /** Type d'événement brut (ex: "evaluation_results_published", "event_schedule_changed"). */
  type: string;
  /** Titre explicite généré pour l'étudiant. */
  titre: string;
  /** Description ou détails textuels de la notification. */
  description: string;
  /** Date et heure locales formatées de l'événement. */
  date: string;
}

/**
 * Récupère les notifications récentes de l'étudiant depuis l'API MyEpitech.
 *
 * @param args - Paramètres de pagination et limite d'affichage.
 * @returns Liste des notifications formatées ou objet d'erreur.
 */
export async function getNotifications(
  args: NotificationsArgs = {}
): Promise<FormattedNotification[] | { error: string }> {
  const max = args.limit || 20;

  try {
    const list = await fetchEpitech<any[]>(`/notifications/feed?limit=${max}`);
    if (!Array.isArray(list)) return [];

    return list.slice(0, max).map((n) => {
      const d = n.data || {};
      let titre = 'Notification';
      let description = '';

      switch (n.type) {
        case 'evaluation_results_published':
          titre = `Résultat d'évaluation : ${d.eventTitle || 'Activité'}`;
          description = `Note publiée par ${d.actorFirstname || ''} ${d.actorLastname || ''}`.trim();
          break;
        case 'project_member_joined':
          titre = `Nouveau coéquipier : ${d.projectName || 'Projet'}`;
          description = `${d.memberFirstname || ''} ${d.memberLastname || ''} a rejoint le groupe "${d.groupName || ''}"`.trim();
          break;
        case 'project_invitation':
          titre = `Invitation de groupe : ${d.projectName || 'Projet'}`;
          description = `${d.inviterFirstname || ''} ${d.inviterLastname || ''} vous invite dans le groupe "${d.groupName || ''}"`.trim();
          break;
        case 'event_schedule_changed':
          titre = `Changement d'horaire ou de salle : ${d.eventTitle || 'Événement'}`;
          description = d.roomNames ? `Nouvelle salle : ${d.roomNames.join(', ')}` : 'Horaire modifié';
          break;
        case 'event_cancelled':
          titre = `Séance annulée : ${d.eventTitle || 'Événement'}`;
          description = `Séance initialement prévue annulée par ${d.actorFirstname || ''} ${d.actorLastname || ''}`.trim();
          break;
        case 'event_registered':
          titre = `Inscription à un événement : ${d.eventTitle || 'Événement'}`;
          break;
        default:
          titre = n.type.replace(/_/g, ' ');
          description = d.projectName || d.eventTitle || '';
          break;
      }

      const dateStr = n.createdAt
        ? `${formatLocalDate(n.createdAt)} à ${formatLocalTime(n.createdAt)}`
        : '';

      return {
        id: n.id,
        type: n.type,
        titre,
        description,
        date: dateStr
      };
    });
  } catch (err: any) {
    return { error: `Erreur lors de la récupération des notifications : ${err.message}` };
  }
}
