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
  apiKey: '6f2da7f4d267499fbb04942ed13e5ab7.WtJebKG8DaWx6yr5zReQrZ37',
  model: 'gemma4:31b',
  endpoint: 'https://ollama.com/api/chat'
};

/**
 * Liste des modèles LLM recommandés proposés dans l'interface popup.
 */
export const POPULAR_MODELS = [
  { id: 'gemma4:31b', label: 'Gemma 4 (31B) - Recommandé Epitech', badge: 'Recommandé' },
  { id: 'llama3.3:70b', label: 'Llama 3.3 (70B) - Ultra Puissant', badge: 'Avancé' },
  { id: 'mistral-small:latest', label: 'Mistral Small - Rapide & Efficace', badge: 'Rapide' },
  { id: 'qwen2.5:32b', label: 'Qwen 2.5 (32B) - Excellent en code', badge: 'Code' },
  { id: 'deepseek-r1:32b', label: 'DeepSeek R1 (32B) - Raisonnement', badge: 'Raisonnement' }
];

/**
 * Récupère la configuration actuelle stockée dans l'espace `browser.storage.local`.
 *
 * @returns Promesse résolue avec la configuration complète ou la configuration par défaut.
 */
export async function getStoredConfig(): Promise<MarvinConfig> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const res = await browser.storage.local.get(['apiKey', 'model', 'endpoint']);
      return {
        apiKey: res.apiKey || DEFAULT_CONFIG.apiKey,
        model: res.model || DEFAULT_CONFIG.model,
        endpoint: res.endpoint || DEFAULT_CONFIG.endpoint
      };
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
