/**
 * @fileoverview Gestionnaire de remplacement des suggestions de démarrage (Starter Chips).
 * Substitue les questions par défaut orientées encadrement/staff de MyEpitech
 * par des suggestions pertinentes pour le quotidien des étudiants.
 * @module injected/utils/studentStarters
 */

/**
 * Définition d'une correspondance pour une suggestion de démarrage.
 */
export interface StarterMapping {
  /** Expression régulière pour détecter le libellé staff d'origine. */
  match: RegExp;
  /** Nouveau libellé affiché sur la pastille dans le chat. */
  label: string;
  /** Requête étudiante transmise à l'assistant lors du clic. */
  prompt: string;
}

/**
 * Suggestions de démarrage personnalisées orientées étudiant.
 */
export const STUDENT_STARTERS: StarterMapping[] = [
  {
    match: /pilotage|steering/i,
    label: '📅 Quels sont mes cours de demain ?',
    prompt: 'Quels sont mes cours de demain ?'
  },
  {
    match: /alerte|alert/i,
    label: '📊 Quelles sont mes dernières notes ?',
    prompt: 'Quelles sont mes dernières notes ?'
  },
  {
    match: /planifier|plan backlog/i,
    label: '⏳ Quel est mon logtime récent ?',
    prompt: "Combien d'heures de logtime ai-je fait ces 14 derniers jours ?"
  },
  {
    match: /attendent encore une note|pending evaluations|évaluations/i,
    label: '🚀 Quels sont mes projets en cours ?',
    prompt: 'Quels sont mes projets en cours ?'
  }
];

/**
 * Table de traduction des invites d'origine (français et anglais) vers les questions étudiantes.
 */
export const STAFF_TO_STUDENT_PROMPT_MAP: Record<string, string> = {
  'Fais-moi un point de pilotage de mon campus': 'Quels sont mes cours de demain ?',
  'Quels étudiants sont en alerte en ce moment ?': 'Quelles sont mes dernières notes ?',
  'Que reste-t-il à planifier ce mois-ci ?': "Combien d'heures de logtime ai-je fait ces 14 derniers jours ?",
  'Quelles évaluations attendent encore une note ?': 'Quels sont mes projets en cours ?',
  'Give me a steering update for my campus': 'Quels sont mes cours de demain ?',
  'Which students are on alert right now?': 'Quelles sont mes dernières notes ?',
  'What is left to plan this month?': "Combien d'heures de logtime ai-je fait ces 14 derniers jours ?",
  'Which evaluations are still waiting for a grade?': 'Quels sont mes projets en cours ?'
};

/** Verrou anti-rebond pour éviter les envois multiples lors d'un clic rapide. */
let isSendingPrompt = false;

/**
 * Injecte un texte dans la zone de saisie du chatbot et déclenche l'envoi programmatique.
 *
 * @param promptText - Requête textuelle à envoyer à Marvin.
 * @returns `true` si le champ a été trouvé et le message envoyé, `false` sinon.
 */
function sendPromptToChatbot(promptText: string): boolean {
  if (isSendingPrompt) return false;
  isSendingPrompt = true;
  setTimeout(() => {
    isSendingPrompt = false;
  }, 1000);

  const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="chatbot-input"]');
  const sendBtn = document.querySelector<HTMLButtonElement>('[data-testid="chatbot-send"]');

  if (textarea) {
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    if (proto && proto.set) {
      proto.set.call(textarea, promptText);
    } else {
      textarea.value = promptText;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    setTimeout(() => {
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
      }
    }, 40);
    return true;
  }
  return false;
}

/**
 * Modifie le texte et les attributs des pastilles de suggestions dans le DOM.
 */
export function transformSuggestionChips(): void {
  const chips = document.querySelectorAll<HTMLElement>('[data-testid="chatbot-suggestion"]');
  if (!chips || chips.length === 0) return;

  chips.forEach((chip, index) => {
    const textNode = chip.querySelector('span, p, div') || chip;
    const currentText = textNode.textContent?.trim() || '';

    let mapping = STUDENT_STARTERS.find((s) => s.match.test(currentText));
    if (!mapping && index < STUDENT_STARTERS.length) {
      mapping = STUDENT_STARTERS[index];
    }

    if (mapping) {
      if (textNode.textContent !== mapping.label) {
        textNode.textContent = mapping.label;
      }
      chip.setAttribute('data-student-prompt', mapping.prompt);
    }
  });
}

/**
 * Injecte les traductions personnalisées directement dans le moteur i18next via l'arbre React Fiber.
 *
 * @returns `true` si le bundle de traduction a été appliqué, `false` sinon.
 */
export function patchI18nStarters(): boolean {
  try {
    const root = document.getElementById('root');
    if (!root) return false;
    const key = Object.keys(root).find(
      (k) => k.startsWith('__reactContainer$') || k.startsWith('__reactFiber$')
    );
    if (!key) return false;

    const node = (root as any)[key];
    const queue = [node];
    let visited = 0;

    while (queue.length > 0 && visited < 150) {
      const current = queue.shift();
      visited++;
      if (!current) continue;

      const i18n = current.memoizedProps?.i18n;
      if (i18n && typeof i18n.addResourceBundle === 'function') {
        const bundle = {
          'chatbot starter steering': STUDENT_STARTERS[0].label,
          'chatbot starter alerts': STUDENT_STARTERS[1].label,
          'chatbot starter plan backlog': STUDENT_STARTERS[2].label,
          'chatbot starter pending evaluations': STUDENT_STARTERS[3].label
        };
        i18n.addResourceBundle('fr', 'translation', bundle, true, true);
        i18n.addResourceBundle('en', 'translation', bundle, true, true);
        return true;
      }

      if (current.child) queue.push(current.child);
      if (current.sibling) queue.push(current.sibling);
    }
  } catch {}
  return false;
}

/** Indicateur d'enregistrement de l'écouteur de clic en phase de capture. */
let clickListenerAttached = false;

/**
 * Initialise l'observateur de mutations et les écouteurs d'événements pour les suggestions.
 */
export function initStudentStartersWatcher(): void {
  if (!clickListenerAttached) {
    clickListenerAttached = true;
    window.addEventListener(
      'click',
      (e) => {
        const chip = (e.target as Element)?.closest<HTMLElement>(
          '[data-testid="chatbot-suggestion"]'
        );
        if (!chip) return;

        // Empêche React d'exécuter son propre gestionnaire pour éviter les doubles requêtes
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const prompt = chip.getAttribute('data-student-prompt') || STUDENT_STARTERS[0].prompt;
        sendPromptToChatbot(prompt);
      },
      true // Phase de capture : s'exécute en amont de l'arbre React
    );
  }

  const observer = new MutationObserver(() => {
    transformSuggestionChips();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (patchI18nStarters() || attempts > 20) {
      clearInterval(timer);
    }
  }, 300);

  setInterval(() => {
    transformSuggestionChips();
  }, 1000);
}
