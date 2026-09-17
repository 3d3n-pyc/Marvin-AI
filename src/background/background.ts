/**
 * @fileoverview Script d'arrière-plan (Background Service Worker).
 * Assure la passerelle réseau non soumise aux restrictions CORS vers le service Ollama
 * et synchronise la configuration avec les contextes de page.
 * @module background
 */

import '../webext';
import { getStoredConfig } from '../config';
import type { BackgroundMessage, MarvinConfig } from '../types';

/**
 * Écouteur principal des messages internes WebExtension (`browser.runtime.sendMessage`).
 */
browser.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  if (message.type === 'OLLAMA_API_CALL') {
    handleOllamaCall(message.payload)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Exécution asynchrone
  }

  if (message.type === 'TEST_CONNECTION') {
    handleTestConnection(message.payload)
      .then((res) => sendResponse({ success: true, data: res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_CONFIG') {
    getStoredConfig()
      .then((cfg) => sendResponse({ success: true, config: cfg }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  return false;
});

/**
 * Effectue un appel réseau POST vers le point d'entrée d'Ollama Cloud / Local.
 *
 * @param payload - Données du chat (messages, tools, options) reçues du page hook.
 * @returns Données de réponse JSON retournées par Ollama.
 * @throws {Error} Si la requête HTTP échoue ou si le serveur retourne un statut d'erreur.
 */
async function handleOllamaCall(payload: any) {
  const config = await getStoredConfig();

  const modelToUse = config.model || payload.model || 'gemma4:31b';
  const finalPayload = {
    ...payload,
    model: modelToUse
  };

  const endpoint = config.endpoint || 'https://ollama.com/api/chat';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(finalPayload)
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const j = await response.json();
      errorMsg = j.error || j.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return await response.json();
}

/**
 * Teste la validité de la connexion et de la clé API auprès du serveur LLM.
 *
 * @param customConfig - Configuration personnalisée à tester (ex: saisie en cours dans le popup).
 * @returns Objet confirmant le succès du test avec aperçu du modèle.
 * @throws {Error} Si la clé est vide ou si l'authentification échoue.
 */
async function handleTestConnection(customConfig?: Partial<MarvinConfig>) {
  const current = await getStoredConfig();
  const apiKey = customConfig?.apiKey || current.apiKey;
  const model = customConfig?.model || current.model || 'gemma4:31b';
  const endpoint = customConfig?.endpoint || current.endpoint || 'https://ollama.com/api/chat';

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Clé API manquante');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: model.trim(),
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    })
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const j = await response.json();
      msg = j.error || j.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  return {
    ok: true,
    model: model,
    responsePreview: data.message?.content?.slice(0, 50) || 'OK'
  };
}

/**
 * Diffuse les changements de configuration en direct à tous les onglets ouverts sur `my.epitech.eu`.
 */
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    getStoredConfig().then((cfg) => {
      browser.tabs.query({ url: '*://my.epitech.eu/*' }).then((tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            browser.tabs
              .sendMessage(tab.id, {
                type: 'MARVIN_CONFIG_UPDATED',
                config: cfg
              })
              .catch(() => {});
          }
        }
      });
    });
  }
});
