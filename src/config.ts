/**
 * @fileoverview Configuration globale par défaut et gestionnaire de persistance pour Marvin AI.
 * @module config
 */

import './webext';
import { logger } from './logger';
import type { MarvinConfig } from './types';

/**
 * Configuration par défaut de l'extension.
 */
export const DEFAULT_CONFIG: MarvinConfig = {
  apiKey: '',
  model: 'olala-v1.0-mini-7a1b'
};

/** Point d'entrée fixe de l'API (compatible OpenAI). */
export const API_ENDPOINT = 'https://api.models.blade.sh/v1/chat/completions';

/** Ancien modèle par défaut, traité comme non défini. */
const LEGACY_DEFAULT_MODEL = 'gemma4:31b';

/** Configuration persistée (sans endpoint, non configurable). */

/**
 * Récupère la configuration actuelle stockée dans l'espace `browser.storage.local`.
 *
 * @returns Promesse résolue avec la configuration complète ou la configuration par défaut.
 */
export async function getStoredConfig(): Promise<MarvinConfig> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const res = await browser.storage.local.get(['apiKey', 'model']);
      const model = res.model && res.model !== LEGACY_DEFAULT_MODEL ? res.model : DEFAULT_CONFIG.model;
      return { apiKey: res.apiKey || DEFAULT_CONFIG.apiKey, model };
    }
  } catch (err) {
    logger.warn('Erreur lors de la lecture du stockage :', err);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Met à jour partiellement ou totalement la configuration dans `browser.storage.local`.
 *
 * @param config - Objet partiel contenant les clés de configuration à modifier.
 */
export async function saveStoredConfig(config: Partial<MarvinConfig>): Promise<void> {
  if (typeof browser !== 'undefined' && browser.storage?.local) {
    await browser.storage.local.set(config);
  }
}
