/**
 * @fileoverview Gestionnaire de mise en page réactive de la zone de saisie du chatbot.
 * Aligne dynamiquement les boutons d'action à droite et ajuste l'affichage
 * selon que la saisie s'étend sur une seule ligne ou plusieurs lignes.
 * @module injected/utils/chatInputLayout
 */

/**
 * Injecte dans le document les règles CSS nécessaires à la disposition réactive.
 */
export function injectChatInputStyles(): void {
  if (document.getElementById('marvin-chat-input-layout-styles')) return;

  const style = document.createElement('style');
  style.id = 'marvin-chat-input-layout-styles';
  style.textContent = `
    /* Boutons d'action systématiquement alignés à droite */
    .mantine-Group-root:has([data-testid="chatbot-send"], [data-testid="chatbot-stop"]) {
      justify-content: flex-end !important;
      margin-left: auto !important;
    }

    [data-testid="chatbot-send"],
    [data-testid="chatbot-stop"] {
      margin-left: auto !important;
    }

    /* Mode mono-ligne (par défaut / quand le texte ne dépasse pas) : sur la même ligne */
    :has(> .mantine-Textarea-root [data-testid="chatbot-input"]):not(.marvin-multiline),
    :has(> [data-testid="chatbot-input"]):not(.marvin-multiline),
    .marvin-singleline {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 6px !important;
    }

    :has(> .mantine-Textarea-root [data-testid="chatbot-input"]):not(.marvin-multiline) .mantine-Textarea-root,
    .marvin-singleline .mantine-Textarea-root {
      flex: 1 1 auto !important;
      min-width: 0 !important;
    }

    :has(> .mantine-Textarea-root [data-testid="chatbot-input"]):not(.marvin-multiline) .mantine-Group-root,
    .marvin-singleline .mantine-Group-root {
      flex: 0 0 auto !important;
      margin-left: auto !important;
      align-self: center !important;
    }

    /* Mode multi-lignes (quand le texte dépasse 1 ligne) */
    .marvin-multiline {
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
    }

    .marvin-multiline .mantine-Textarea-root {
      width: 100% !important;
    }

    .marvin-multiline .mantine-Group-root {
      width: 100% !important;
      display: flex !important;
      justify-content: flex-end !important;
      margin-left: auto !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Évalue la hauteur du texte saisi et applique les classes CSS correspondantes (`.marvin-singleline` ou `.marvin-multiline`).
 */
export function updateChatInputLayout(): void {
  const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="chatbot-input"]');
  if (!textarea) return;

  const box = textarea.closest<HTMLElement>('.mantine-Textarea-root')?.parentElement;
  if (!box) return;

  // Un texte est considéré multiligne s'il contient un retour chariot ou si son scrollHeight dépasse la ligne de base (~36px)
  const isMultiLine = textarea.value.includes('\n') || textarea.scrollHeight > 36;

  if (isMultiLine) {
    if (!box.classList.contains('marvin-multiline')) {
      box.classList.add('marvin-multiline');
      box.classList.remove('marvin-singleline');
    }
  } else {
    if (!box.classList.contains('marvin-singleline')) {
      box.classList.add('marvin-singleline');
      box.classList.remove('marvin-multiline');
    }
  }
}

/**
 * Initialise les écouteurs d'événements DOM pour surveiller dynamiquement la saisie.
 */
export function initChatInputWatcher(): void {
  injectChatInputStyles();

  document.addEventListener(
    'input',
    (e) => {
      if ((e.target as Element)?.matches?.('[data-testid="chatbot-input"]')) {
        updateChatInputLayout();
      }
    },
    true
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.target as Element)?.matches?.('[data-testid="chatbot-input"]')) {
        setTimeout(updateChatInputLayout, 10);
      }
    },
    true
  );

  const observer = new MutationObserver(() => {
    updateChatInputLayout();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  setInterval(updateChatInputLayout, 600);
}
