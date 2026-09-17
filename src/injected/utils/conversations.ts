/**
 * @fileoverview Gestionnaire de stockage et de persistance des conversations Marvin.
 * Sauvegarde l'historique complet dans le `localStorage` du domaine `my.epitech.eu`.
 * @module injected/utils/conversations
 */

import type { Conversation } from '../../types';

/** Clé de persistance dans le localStorage. */
const STORAGE_KEY = 'marvin_official_conversations';

/**
 * Récupère la liste de toutes les conversations enregistrées dans le navigateur.
 * Initialise une première conversation d'accueil si aucune session n'existe.
 *
 * @returns Tableau ordonné des conversations existantes.
 */
export function getLocalConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {}

  const initial: Conversation[] = [
    {
      id: 'conv_default',
      title: 'Discussion avec Marvin',
      preview: 'Bonjour ! Je suis Marvin...',
      updatedAt: new Date().toISOString(),
      messages: [
        {
          role: 'assistant',
          content:
            "Bonjour ! Je suis Marvin, l'assistant MyEpitech.\n\nJe peux consulter vos notes, votre planning, vos projets ou votre logtime. Que souhaitez-vous savoir ?",
          toolCalls: []
        }
      ]
    }
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

/**
 * Enregistre la liste des conversations dans le `localStorage`.
 *
 * @param convs - Tableau complet des conversations à sérialiser.
 */
export function saveLocalConversations(convs: Conversation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}
