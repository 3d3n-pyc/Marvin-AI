/**
 * @fileoverview Module de journalisation unifié pour Marvin AI.
 * Harmonise les sorties console sous le préfixe unique `[Marvin]`.
 * @module logger
 */

/** Préfixe standard apposé devant chaque message de journalisation. */
const LOG_PREFIX = '[Marvin]';

/**
 * Gestionnaire de journalisation fournissant des méthodes typées et préfixées.
 */
export const logger = {
  /**
   * Émet un avertissement dans la console du navigateur.
   *
   * @param message - Message descriptif de l'avertissement.
   * @param optionalParams - Paramètres ou objets d'erreur complémentaires.
   */
  warn(message: string, ...optionalParams: any[]): void {
    console.warn(`${LOG_PREFIX} ${message}`, ...optionalParams);
  },

  /**
   * Émet une erreur dans la console du navigateur.
   *
   * @param message - Message descriptif de l'erreur.
   * @param optionalParams - Paramètres ou objets d'erreur complémentaires.
   */
  error(message: string, ...optionalParams: any[]): void {
    console.error(`${LOG_PREFIX} ${message}`, ...optionalParams);
  },

  /**
   * Émet une information (uniquement si le mode débogage est activé dans localStorage ou window).
   *
   * @param message - Message d'information.
   * @param optionalParams - Paramètres complémentaires.
   */
  info(message: string, ...optionalParams: any[]): void {
    if (isDebugEnabled()) {
      console.info(`${LOG_PREFIX} ${message}`, ...optionalParams);
    }
  },

  /**
   * Émet un message de débogage technique (inactif par défaut).
   *
   * @param message - Message technique de débogage.
   * @param optionalParams - Paramètres complémentaires.
   */
  debug(message: string, ...optionalParams: any[]): void {
    if (isDebugEnabled()) {
      console.debug(`${LOG_PREFIX} ${message}`, ...optionalParams);
    }
  }
};

/**
 * Vérifie si le mode débogage étendu est actif.
 *
 * @returns `true` si le flag de debug est positionné sur l'objet global ou dans le stockage local.
 */
function isDebugEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      if ((window as any).__MARVIN_DEBUG__) return true;
      if (window.localStorage && window.localStorage.getItem('marvin_debug') === 'true') {
        return true;
      }
    }
  } catch {}
  return false;
}
