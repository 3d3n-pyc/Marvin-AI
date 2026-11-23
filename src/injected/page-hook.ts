/**
 * @fileoverview Script d'injection principal exécuté dans le contexte de la page MyEpitech (main world).
 * - Injecte le bouton MARVIN_ dans la barre de navigation.
 * - Ouvre le panneau de chat autonome et le relie au moteur de chat (Ollama + outils).
 * @module injected/page-hook
 */

import { createPanel, type ChatPanel } from './chat/panel';
import { runChat } from './chat/engine';
import { logger } from '../logger';

(function () {
  'use strict';

  if ((window as any).__marvin_page_hook_installed) return;
  (window as any).__marvin_page_hook_installed = true;

  let panel: ChatPanel | null = null;
  let convId = newConvId();

  /**
   * Génère un identifiant de conversation unique.
   *
   * @returns Identifiant de conversation.
   */
  function newConvId(): string {
    return 'conv_' + Date.now();
  }

  /**
   * Envoie un message au moteur de chat et affiche la réponse ou l'erreur dans le panneau.
   *
   * @param p - Panneau de chat.
   * @param text - Message de l'utilisateur.
   */
  async function send(p: ChatPanel, text: string): Promise<void> {
    const id = convId;
    const current = () => id === convId;
    p.setBusy(true);
    try {
      const reply = await runChat(text, id, {
        onTool: (n) => { if (current()) p.showTool(n); },
        confirm: (s) => p.confirm(s)
      });
      if (current()) p.addMessage('assistant', reply);
    } catch (err: any) {
      logger.error('Erreur du chat :', err);
      if (current()) p.showError(err?.message || 'Une erreur est survenue', () => void send(p, text));
    } finally {
      if (current()) p.setBusy(false);
    }
  }

  /**
   * Crée le panneau de chat au premier appel puis le réutilise.
   *
   * @returns Panneau de chat unique.
   */
  function getPanel(): ChatPanel {
    if (panel) return panel;
    const p = createPanel();
    p.onSend((text) => {
      p.addMessage('user', text);
      void send(p, text);
    });
    p.onNewChat(() => {
      convId = newConvId();
      p.clear();
    });
    panel = p;
    return p;
  }

  setInterval(() => {
    if (document.querySelector('[data-testid="chatbot-open"]')) return;

    const header = document.querySelector('header');
    if (!header) return;

    const actionsContainer = header.querySelector('.mantine-Group-root:last-child') || header;
    if (!actionsContainer || document.getElementById('marvin-navbar-fallback-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'marvin-navbar-fallback-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Chatbot Marvin');
    btn.setAttribute('data-testid', 'chatbot-open');
    btn.className = 'marvin-trigger';
    btn.style.cssText = `
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 14px 0 8px;
      background: rgba(255,255,255,0.10);
      border: 1px solid rgba(255,255,255,0.30);
      border-radius: 6px;
      cursor: pointer;
      color: #fff;
      font-family: var(--mantine-font-family-monospace, ui-monospace, monospace);
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      margin-right: 8px;
    `;

    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#00ff97" aria-hidden="true">
        <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/>
        <path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z"/>
      </svg>
      <span>MARVIN<span style="color:#00ff97">_</span></span>
    `;

    btn.onclick = (e) => {
      e.preventDefault();
      getPanel().toggle();
    };

    actionsContainer.prepend(btn);
  }, 500);
})();
