/**
 * @fileoverview Client HTTP utilitaire pour les appels vers l'API interne de MyEpitech.
 * Gère l'injection automatique du jeton Bearer JWT extrait de la session locale.
 * @module injected/utils/api
 */

/**
 * Récupère le jeton JWT d'authentification Epitech depuis le `localStorage`.
 *
 * @returns Le jeton JWT sous forme de chaîne de caractères, ou `null` si non connecté.
 */
export function getEpitechToken(): string | null {
  try {
    const raw = localStorage.getItem('@account');
    if (!raw) return null;
    const acc = JSON.parse(raw);
    return acc?.token || null;
  } catch {
    return null;
  }
}

/**
 * Options de configuration pour une requête vers l'API MyEpitech.
 */
export interface FetchEpitechOptions {
  /** Méthode HTTP (GET, POST, DELETE, etc.). Par défaut : "GET". */
  method?: string;
  /** Corps de la requête (objet JSON ou chaîne de caractères). */
  body?: any;
  /** En-têtes HTTP additionnels. */
  headers?: Record<string, string>;
}

/**
 * Exécute une requête authentifiée vers l'API MyEpitech (`/api/...`).
 *
 * @template T - Type attendu de la réponse JSON.
 * @param endpoint - Chemin relatif de l'API (ex: "/students/profile").
 * @param options - Paramètres de la requête (méthode, corps, headers).
 * @returns Promesse résolue avec les données désérialisées de la réponse.
 * @throws {Error} Si le code de statut HTTP indique une erreur (>= 400).
 */
export async function fetchEpitech<T = any>(
  endpoint: string,
  options: FetchEpitechOptions = {}
): Promise<T> {
  const token = getEpitechToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(`/api${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.message || JSON.stringify(errJson);
    } catch {}
    throw new Error(`HTTP ${res.status}${errorDetail ? ` (${errorDetail})` : ''}`);
  }

  // Prise en charge des réponses vides (204 No Content)
  if (res.status === 204) return {} as T;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}
