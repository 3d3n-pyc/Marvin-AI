/**
 * @fileoverview Générateur de titres intelligent pour les discussions Marvin.
 * Utilise l'IA (Ollama) pour titrer précisément chaque conversation avec fallback heuristique nettoyé.
 * @module injected/utils/titleGenerator
 */

import { logger } from '../../logger';

/**
 * Nettoie et formate une chaîne de titre brute renvoyée par le modèle ou l'heuristique.
 *
 * @param raw - Texte brut du titre.
 * @returns Titre propre, capitalisé et d'une longueur maximale de 40 caractères.
 */
export function sanitizeTitle(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'Discussion';

  let text = raw;

  // Élimine les blocs de raisonnement (DeepSeek R1, Gemma, Qwen)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '');

  // Nettoie les retours à la ligne résiduels
  if (text.includes('\n')) {
    text = text.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
  }

  // Élimine les préfixes bavards de l'IA
  text = text.replace(
    /^(titre\s*:|title\s*:|voici un titre\s*:|sujet\s*:|titre proposé\s*:|conversation\s*:)\s*/i,
    ''
  );

  // Élimine les délimiteurs, guillemets et markdown
  text = text.replace(/^["'«`\s*#]+|["'»`\s*#\.\?!:;]+$/g, '').trim();

  // Élimine le gras markdown résiduel
  text = text.replace(/\*\*/g, '').trim();

  if (!text) return 'Discussion';

  // Capitalisation de la première lettre
  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (text.length > 40) {
    text = text.slice(0, 37).trim() + '...';
  }

  return text;
}

/**
 * Génère un titre immédiat à partir du premier message utilisateur sans latence réseau.
 * Sert de titre provisoire et de fallback robuste si la requête IA échoue ou tarde.
 *
 * @param input - Texte du premier message saisi par l'étudiant.
 * @returns Titre propre et capitalisé.
 */
export function generateFastTitle(input: string): string {
  if (!input || typeof input !== 'string') return 'Discussion';

  const clean = input.trim();

  // Élimination des formules de politesse et préfixes interrogatifs verbeux
  let stripped = clean
    .replace(
      /^(bonjour|salut|coucou|bonsoir|dis[- ]moi|peux[- ]tu me dire|peux[- ]tu|pourrais[- ]tu|est[- ]ce que|s'il te plaît|stp|je voudrais savoir|j'aimerais savoir|sais[- ]tu|quels sont|quelles sont|quel est|quelle est|combien de|qui est|comment|où est|où sont)\s+/i,
      ''
    )
    .replace(/[?!.:;]+$/g, '')
    .trim();

  if (!stripped) return 'Discussion';

  return sanitizeTitle(stripped);
}

/**
 * Génère un titre concis et contextuel via une requête dédiée au modèle IA.
 *
 * @param userPrompt - Texte du message initial de l'étudiant.
 * @param modelName - Nom du modèle actif (ex: "gemma4:31b").
 * @param callOllama - Fonction passerelle vers l'API Ollama.
 * @param assistantPreview - Extrait optionnel de la réponse de Marvin pour affiner le contexte.
 * @returns Titre généré par l'IA ou `null` en cas d'échec ou de dépassement de délai.
 */
export async function generateAiTitle(
  userPrompt: string,
  modelName: string,
  callOllama: (payload: any) => Promise<any>,
  assistantPreview?: string
): Promise<string | null> {
  if (!userPrompt || userPrompt.trim().length < 2) return null;

  const promptContent = assistantPreview
    ? `Demande de l'étudiant : "${userPrompt.slice(0, 200)}"\nRéponse : "${assistantPreview.slice(0, 200)}"`
    : userPrompt.slice(0, 300);

  const titlePromise = callOllama({
    model: modelName,
    messages: [
      {
        role: 'system',
        content:
          "Tu es un générateur de titres pour un chatbot étudiant. Génère un titre ultra-court (3 à 5 mots maximum) résumant la demande. Réponds UNIQUEMENT le titre, en français, sans guillemets, sans ponctuation et sans phrase d'introduction."
      },
      {
        role: 'user',
        content: promptContent
      }
    ],
    stream: false,
    options: {
      temperature: 0.2,
      num_predict: 25
    }
  });

  // Timeout de sécurité à 2500ms pour préserver la réactivité
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));

  try {
    const response = await Promise.race([titlePromise, timeoutPromise]);
    if (!response) return null;

    const rawTitle = response?.message?.content;
    if (!rawTitle) return null;

    const cleaned = sanitizeTitle(rawTitle);
    return cleaned && cleaned !== 'Discussion' ? cleaned : null;
  } catch (err) {
    logger.warn('Génération du titre IA indisponible :', err);
    return null;
  }
}
