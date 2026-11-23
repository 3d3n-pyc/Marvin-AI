/**
 * @fileoverview Passerelle postMessage Page -> Content Script -> Background vers Ollama Cloud.
 * @module injected/chat/bridge
 */

/**
 * Transmet une requête d'inférence au Content Script via `window.postMessage`.
 * Le listener est toujours retiré (réponse, erreur ou délai dépassé).
 *
 * @param payload - Paramètres de requête de chat pour Ollama.
 * @param timeoutMs - Délai maximal d'attente en millisecondes.
 * @returns Promesse résolue avec la réponse d'Ollama.
 * @throws {Error} En cas d'erreur de réponse ou de dépassement de délai.
 */
export function callOllama(payload: unknown, timeoutMs = 60000): Promise<any> {
  return new Promise((resolve, reject) => {
    const callId = 'ollama_' + Math.random().toString(36).substring(2, 11);
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error(`Délai dépassé (${timeoutMs} ms) en attendant blade.sh`));
    }, timeoutMs);

    function handler(ev: MessageEvent) {
      if (!ev.data || ev.data.type !== 'MARVIN_OLLAMA_CALL_RES' || ev.data.id !== callId) return;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      if (ev.data.error) reject(new Error(ev.data.error));
      else resolve(ev.data.data);
    }

    window.addEventListener('message', handler);
    window.postMessage({ type: 'MARVIN_OLLAMA_CALL_REQ', id: callId, payload }, '*');
  });
}
