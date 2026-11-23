/**
 * @fileoverview Script d'arrière-plan (Background Service Worker).
 * Assure la passerelle réseau non soumise aux restrictions CORS vers le service blade.sh
 * et synchronise la configuration avec les contextes de page.
 * @module background
 */

import '../webext';
import { API_ENDPOINT, DEFAULT_CONFIG, getStoredConfig } from '../config';
import { fromOpenAIResponse, toOpenAIRequest } from './openai';
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

const MAX_PAYLOAD_BYTES = 200 * 1024;
const ALLOWED_ROLES = ['system', 'user', 'assistant', 'tool'];

/**
 * Vérifie qu'un message de chat respecte la forme attendue.
 *
 * @param m - Message à valider.
 * @returns `true` si le message est valide.
 */
function isValidMessage(m: any): boolean {
  if (!m || typeof m !== 'object' || !ALLOWED_ROLES.includes(m.role)) return false;
  if (typeof m.content !== 'string') return false;
  if (m.tool_calls !== undefined && !Array.isArray(m.tool_calls)) return false;
  return m.tool_name === undefined || typeof m.tool_name === 'string';
}

/**
 * Borne une valeur numérique ; retourne le repli si la valeur n'est pas un nombre fini.
 *
 * @param value - Valeur non fiable reçue de la page.
 * @param min - Borne inférieure.
 * @param max - Borne supérieure.
 * @param fallback - Valeur utilisée si `value` est absente ou invalide.
 * @returns Valeur bornée, ou `fallback`.
 */
function clampOption(value: unknown, min: number, max: number, fallback?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Ne conserve que les options Ollama autorisées, bornées et avec leurs valeurs par défaut.
 *
 * @param options - Options non fiables reçues de la page.
 * @returns Options Ollama sûres.
 */
function pickOllamaOptions(options: any) {
  const src = options && typeof options === 'object' ? options : {};
  const numPredict = clampOption(src.num_predict, 1, 4096);
  return {
    temperature: clampOption(src.temperature, 0, 1, 0.1),
    top_p: clampOption(src.top_p, 0, 1, 0.9),
    num_ctx: clampOption(src.num_ctx, 512, 8192, 8192),
    ...(numPredict !== undefined && { num_predict: numPredict })
  };
}

/**
 * Construit la requête Ollama à partir d'une liste blanche de champs.
 *
 * @param payload - Données non fiables reçues de la page.
 * @param model - Modèle configuré par l'utilisateur (le modèle du payload est ignoré).
 * @returns Requête sûre à envoyer à Ollama.
 * @throws {Error} Si la forme est invalide ou la taille excède la limite.
 */
function sanitizeOllamaPayload(payload: any, model: string) {
  if (!payload || !Array.isArray(payload.messages) || !payload.messages.every(isValidMessage)) {
    throw new Error('Requête invalide : messages');
  }
  if (payload.tools !== undefined && !Array.isArray(payload.tools)) {
    throw new Error('Requête invalide : tools');
  }
  const messages = payload.messages.map((m: any) => ({
    role: m.role,
    content: m.content,
    ...(m.tool_calls !== undefined && { tool_calls: m.tool_calls }),
    ...(m.tool_name !== undefined && { tool_name: m.tool_name })
  }));
  const clean = {
    model,
    messages,
    tools: payload.tools ?? [],
    stream: false,
    options: pickOllamaOptions(payload.options)
  };
  if (JSON.stringify(clean).length > MAX_PAYLOAD_BYTES) {
    throw new Error('Requête trop volumineuse');
  }
  return clean;
}

/**
 * Extrait un message d'erreur lisible (statut + message API) d'une réponse non-2xx.
 *
 * @param response - Réponse HTTP en erreur.
 * @returns Message d'erreur, sans la clé API.
 */
async function readApiError(response: Response): Promise<string> {
  let msg = '';
  try {
    const j = await response.json();
    const e = j?.error;
    msg = typeof e === 'string' ? e : e?.message || j?.message || '';
  } catch {}
  return msg ? `HTTP ${response.status} : ${msg}` : `HTTP ${response.status}`;
}

/**
 * Détermine le code d'erreur d'un fetch rejeté : permission d'hôte absente ou réseau.
 *
 * @returns 'HOST_PERMISSION_MISSING' si l'accès à l'API n'est pas accordé, sinon 'NETWORK_ERROR'.
 */
async function networkErrorCode(): Promise<string> {
  try {
    if (!browser.permissions?.contains) return 'NETWORK_ERROR';
    const granted = await browser.permissions.contains({ origins: ['https://api.models.blade.sh/*'] });
    return granted ? 'NETWORK_ERROR' : 'HOST_PERMISSION_MISSING';
  } catch {
    return 'NETWORK_ERROR';
  }
}

/**
 * Envoie une requête de chat à l'API blade.sh et convertit la réponse.
 *
 * @param apiKey - Clé API Bearer.
 * @param body - Corps de requête OpenAI.
 * @returns Réponse au format Ollama.
 * @throws {Error} Si le statut HTTP est une erreur ou si la réponse est invalide.
 */
async function postChat(apiKey: string, body: object) {
  let response: Response;
  try {
    response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(await networkErrorCode());
  }
  if (!response.ok) throw new Error(await readApiError(response));
  return fromOpenAIResponse(await response.json());
}

/**
 * Effectue un appel de chat vers l'API blade.sh.
 *
 * @param payload - Données du chat (messages, tools, options) reçues du page hook.
 * @returns Réponse au format Ollama.
 * @throws {Error} Si la clé est absente, la requête invalide ou l'API en erreur.
 */
async function handleOllamaCall(payload: any) {
  const config = await getStoredConfig();
  if (!config.apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  const model = config.model || DEFAULT_CONFIG.model;
  const clean = sanitizeOllamaPayload(payload, model);
  return postChat(config.apiKey, toOpenAIRequest(clean, model));
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
  const apiKey = (customConfig?.apiKey || current.apiKey || '').trim();
  const model = (customConfig?.model || current.model || DEFAULT_CONFIG.model).trim();

  if (!apiKey) {
    throw new Error('Clé API manquante');
  }

  const clean = sanitizeOllamaPayload({ messages: [{ role: 'user', content: 'ping' }] }, model);
  const data: any = await postChat(apiKey, toOpenAIRequest(clean, model));
  return {
    ok: true,
    model,
    responsePreview: data.message?.content?.slice(0, 50) || 'OK'
  };
}

/**
 * Diffuse les changements de configuration en direct à tous les onglets ouverts sur `my.epitech.eu`.
 */
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    getStoredConfig().then((cfg) => {
      browser.tabs.query({ url: 'https://my.epitech.eu/*' }).then((tabs) => {
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
