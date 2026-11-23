/**
 * @fileoverview Conversion entre le format Ollama (utilisé par le moteur) et l'API OpenAI de blade.sh.
 * @module background/openai
 */

import type { OllamaChatResponse, ToolCall } from '../types';

/** Appel d'outil en attente de résultat. */
interface PendingCall {
  id: string;
  name: string;
}

/** État de conversion : compteur d'identifiants et appels du dernier tour assistant. */
interface ConvState {
  counter: number;
  pending: PendingCall[];
}

/**
 * Convertit les tool_calls Ollama en tool_calls OpenAI avec identifiants générés.
 *
 * @param calls - Appels d'outils au format Ollama.
 * @param state - État de conversion (mis à jour).
 * @returns Appels d'outils au format OpenAI.
 */
function convertToolCalls(calls: ToolCall[], state: ConvState): object[] {
  state.pending = [];
  return calls.map((c) => {
    const id = `call_${state.counter++}`;
    const args = c.function.arguments;
    state.pending.push({ id, name: c.function.name });
    return {
      id,
      type: 'function',
      function: { name: c.function.name, arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}) }
    };
  });
}

/**
 * Retire de la file l'appel en attente correspondant à un message outil.
 *
 * @param state - État de conversion (mis à jour).
 * @param toolName - Nom de l'outil si connu.
 * @returns Identifiant de l'appel, ou chaîne vide s'il n'y en a plus.
 */
function takePendingId(state: ConvState, toolName?: string): string {
  const named = toolName ? state.pending.findIndex((p) => p.name === toolName) : -1;
  const idx = named >= 0 ? named : 0;
  return state.pending.splice(idx, 1)[0]?.id ?? '';
}

/**
 * Convertit un message Ollama en message OpenAI.
 *
 * @param m - Message Ollama.
 * @param state - État de conversion.
 * @returns Message OpenAI, ou null pour un message outil orphelin (sans appel en attente).
 */
function convertMessage(m: any, state: ConvState): object | null {
  const content = typeof m.content === 'string' ? m.content : '';
  if (m.role === 'tool') {
    const id = takePendingId(state, m.tool_name);
    return id ? { role: 'tool', tool_call_id: id, content } : null;
  }
  if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
    return { role: 'assistant', content, tool_calls: convertToolCalls(m.tool_calls, state) };
  }
  return { role: m.role, content };
}

/**
 * Convertit les options Ollama en paramètres OpenAI (num_ctx et autres sont ignorés).
 *
 * @param options - Options d'inférence Ollama.
 * @returns Paramètres temperature, top_p et max_tokens présents.
 */
function convertOptions(options?: Record<string, any>): Record<string, number> {
  const out: Record<string, number> = {};
  if (!options) return out;
  if (typeof options.temperature === 'number') out.temperature = options.temperature;
  if (typeof options.top_p === 'number') out.top_p = options.top_p;
  if (typeof options.num_predict === 'number') out.max_tokens = options.num_predict;
  return out;
}

/**
 * Construit le corps d'une requête chat/completions OpenAI depuis un payload Ollama assaini.
 *
 * @param payload - Requête Ollama ({messages, tools?, options?}).
 * @param model - Identifiant du modèle blade.sh.
 * @returns Corps JSON de la requête OpenAI (stream désactivé).
 */
export function toOpenAIRequest(payload: any, model: string): object {
  const state: ConvState = { counter: 0, pending: [] };
  const messages = (payload?.messages ?? [])
    .map((m: any) => convertMessage(m, state))
    .filter((m: object | null): m is object => m !== null);
  return {
    model,
    messages,
    ...(payload?.tools?.length > 0 && { tools: payload.tools }),
    stream: false,
    ...convertOptions(payload?.options)
  };
}

/**
 * Convertit les tool_calls OpenAI en ToolCall Ollama (arguments parsés, ou chaîne brute si invalides).
 *
 * @param calls - Appels d'outils OpenAI.
 * @returns Appels d'outils au format Ollama.
 */
function parseToolCalls(calls: any[]): ToolCall[] {
  return calls.map((c) => {
    const raw = c?.function?.arguments;
    let args: ToolCall['function']['arguments'] = raw ?? {};
    if (typeof raw === 'string') {
      try {
        args = JSON.parse(raw);
      } catch {
        args = raw;
      }
    }
    return { function: { name: String(c?.function?.name ?? ''), arguments: args } };
  });
}

/**
 * Convertit une réponse chat/completions OpenAI en réponse Ollama.
 *
 * @param json - Réponse JSON de l'API.
 * @returns Réponse au format Ollama.
 * @throws Error si l'API renvoie une erreur ou aucun choix.
 */
export function fromOpenAIResponse(json: unknown): OllamaChatResponse & { done: boolean; model?: string } {
  const data = json as any;
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Erreur API');
  }
  const msg = Array.isArray(data?.choices) ? data.choices[0]?.message : undefined;
  if (!msg) throw new Error('Réponse API invalide : aucun choix retourné');
  const calls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0 ? parseToolCalls(msg.tool_calls) : undefined;
  return {
    model: data.model,
    done: true,
    message: { role: 'assistant', content: msg.content ?? '', ...(calls && { tool_calls: calls }) }
  };
}
