/**
 * @fileoverview Définitions de types TypeScript pour Marvin AI.
 * @module types
 */

/**
 * Configuration utilisateur persistée pour le client Ollama.
 */
export interface MarvinConfig {
  /** Clé d'API Bearer pour l'authentification auprès du service Ollama. */
  apiKey: string;
  /** Identifiant du modèle LLM cible (ex: "gemma4:31b", "qwen2.5:32b"). */
  model: string;
  /** Point d'entrée HTTP de l'API de chat (ex: "https://ollama.com/api/chat"). */
  endpoint: string;
}

/**
 * Message d'échange dans une conversation Ollama / Marvin.
 */
export interface ChatMessage {
  /** Rôle de l'émetteur du message. */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Contenu textuel du message. */
  content?: string;
  /** Appels d'outils générés par le modèle (format Ollama conventionnel). */
  tool_calls?: ToolCall[];
  /** Alias de tool_calls pour la compatibilité avec le frontend MyEpitech. */
  toolCalls?: ToolCall[];
}

/**
 * Appel de fonction émis par le modèle de langage.
 */
export interface ToolCall {
  /** Identifiant unique de l'appel d'outil. */
  id?: string;
  /** Type d'appel (par défaut "function"). */
  type?: string;
  /** Détails de la fonction appelée et ses arguments. */
  function: {
    /** Nom de la fonction cible. */
    name: string;
    /** Arguments JSON sérialisés ou objet analysé. */
    arguments: Record<string, any> | string;
  };
}

/**
 * Session de discussion persistée dans le stockage local du navigateur.
 */
export interface Conversation {
  /** Identifiant unique de la conversation (ex: "conv_1726521600000"). */
  id: string;
  /** Titre synthétique affiché dans la barre latérale. */
  title: string;
  /** Aperçu textuel du dernier message échangé. */
  preview: string;
  /** Horodatage ISO 8601 de la dernière mise à jour. */
  updatedAt: string;
  /** Historique séquentiel des messages de la discussion. */
  messages: ChatMessage[];
  /** Nombre total de messages de la discussion. */
  messageCount?: number;
}

/**
 * Déclaration de schéma d'un outil compatible OpenAPI / Ollama tool calling.
 */
export interface ToolDefinition {
  /** Type d'outil ("function"). */
  type: 'function';
  /** Définition de la fonction exécutable et de ses paramètres. */
  function: {
    /** Nom technique de la fonction. */
    name: string;
    /** Description sémantique utilisée par le LLM pour déterminer quand appeler l'outil. */
    description: string;
    /** Schéma JSON décrivant les arguments acceptés. */
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Corps de la requête envoyée à l'API Ollama `/api/chat`.
 */
export interface OllamaChatPayload {
  /** Modèle de langage à interroger. */
  model?: string;
  /** Historique complet des messages comprenant le message système. */
  messages: ChatMessage[];
  /** Liste des outils disponibles pour le modèle. */
  tools?: ToolDefinition[];
  /** Activation ou désactivation du streaming SSE. */
  stream?: boolean;
  /** Options d'inférence (température, fenêtre de contexte num_ctx, top_p). */
  options?: Record<string, any>;
}

/**
 * Structure de réponse renvoyée par l'API Ollama `/api/chat`.
 */
export interface OllamaChatResponse {
  /** Message résultant généré par le modèle assistant. */
  message?: {
    role: string;
    content?: string;
    tool_calls?: ToolCall[];
  };
  /** Message d'erreur éventuel en cas d'échec de la requête. */
  error?: string;
}

/**
 * Message transitant via l'API `browser.runtime.sendMessage` vers le script d'arrière-plan.
 */
export interface BackgroundMessage {
  /** Type d'action demandée au background script. */
  type: 'OLLAMA_API_CALL' | 'TEST_CONNECTION' | 'GET_CONFIG';
  /** Données associées à l'action. */
  payload?: any;
}
