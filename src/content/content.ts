/**
 * @fileoverview Script de contenu (Content Script) injecté dans le contexte isolé de `my.epitech.eu`.
 * Joue le rôle de passerelle d'échange de messages entre le DOM principal (page-hook)
 * et le script d'arrière-plan de l'extension.
 * @module content
 */

import '../webext';

(function () {
  'use strict';

  /**
   * Écouteur des messages `postMessage` émis par le script injecté dans le monde de la page.
   */
  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data) return;

    // Relais de la requête de chat vers le background script (CORS bypass)
    if (event.data.type === 'MARVIN_OLLAMA_CALL_REQ') {
      const { id, payload } = event.data;
      try {
        const response = await browser.runtime.sendMessage({
          type: 'OLLAMA_API_CALL',
          payload
        });

        if (response?.success) {
          window.postMessage({ type: 'MARVIN_OLLAMA_CALL_RES', id, data: response.data }, '*');
        } else {
          window.postMessage(
            { type: 'MARVIN_OLLAMA_CALL_RES', id, error: response?.error || 'Erreur inconnue' },
            '*'
          );
        }
      } catch (err: any) {
        window.postMessage({ type: 'MARVIN_OLLAMA_CALL_RES', id, error: err.message }, '*');
      }
    }

    // Demande de configuration initiale du modèle
    if (event.data.type === 'MARVIN_GET_CONFIG_REQ') {
      try {
        const stored = await browser.storage.local.get(['model']);
        window.postMessage(
          {
            type: 'MARVIN_GET_CONFIG_RES',
            model: stored?.model || 'gemma4:31b'
          },
          '*'
        );
      } catch {}
    }
  });

  /**
   * Écouteur des messages de synchronisation émis par le script d'arrière-plan.
   */
  browser.runtime.onMessage.addListener((message: any) => {
    if (message?.type === 'MARVIN_CONFIG_UPDATED') {
      window.postMessage(
        {
          type: 'MARVIN_CONFIG_UPDATED',
          model: message.config?.model || 'gemma4:31b'
        },
        '*'
      );
    }
  });

  /**
   * Injecte la balise `<script>` pointant vers `page-hook.js` dans le contexte d'exécution de la page.
   */
  function injectPageScript(): void {
    if (document.getElementById('marvin-page-hook-script')) return;
    const script = document.createElement('script');
    script.id = 'marvin-page-hook-script';
    script.src = browser.runtime.getURL('page-hook.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  // Déclenchement de l'injection dès que l'en-tête ou la racine du DOM est disponible
  if (document.head || document.documentElement) {
    injectPageScript();
  } else {
    const observer = new MutationObserver(() => {
      if (document.head || document.documentElement) {
        observer.disconnect();
        injectPageScript();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }
})();
