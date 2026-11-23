/**
 * Chat panel UI mounted in a closed Shadow DOM. All text is rendered with textContent.
 */

export interface ChatPanel {
  toggle(): void;
  close(): void;
  onSend(cb: (text: string) => void): void;
  onNewChat(cb: () => void): void;
  addMessage(role: 'user' | 'assistant', text: string): void;
  clear(): void;
  setBusy(on: boolean): void;
  showTool(name: string): void;
  showError(message: string, retry: () => void): void;
  confirm(summary: string): Promise<boolean>;
}

const CSS = `
:host { all: initial; }
.panel { position: fixed; top: 72px; right: 16px; width: 380px; height: 560px; max-height: 80vh;
  display: none; flex-direction: column; background: #0d0f12; color: #e6e6e6;
  border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; z-index: 2147483000;
  font: 13px ui-monospace, monospace; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
.panel.open { display: flex; }
header { display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.15); }
.title { font-weight: 700; letter-spacing: 0.07em; flex: 1; }
.title span { color: #00ff97; }
button { font: inherit; color: #e6e6e6; background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
button.primary { background: #00ff97; color: #0d0f12; border-color: #00ff97; font-weight: 700; }
.list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.msg, .line { white-space: pre-wrap; word-break: break-word; }
.msg { padding: 8px 10px; border-radius: 6px; max-width: 90%; }
.msg.user { align-self: flex-end; background: rgba(0,255,151,0.15); border: 1px solid #00ff97; }
.msg.assistant { align-self: flex-start; background: rgba(255,255,255,0.08); }
.tool { color: #888; font-size: 11px; }
.error { color: #ff5c5c; }
.busy { color: #00ff97; font-style: italic; }
.row { display: flex; gap: 8px; margin-top: 6px; }
footer { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(255,255,255,0.15); }
textarea { flex: 1; resize: none; height: 44px; font: inherit; color: #e6e6e6; background: #000;
  border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; padding: 6px; }
textarea:disabled { opacity: 0.5; }
`;

/** Create an element with a class and optional text (textContent only). */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

/** Create a button with a label and click handler. */
function btn(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** Build the static panel skeleton inside the shadow root. */
function buildSkeleton(root: ShadowRoot) {
  const style = el('style');
  style.textContent = CSS;
  const panel = el('div', 'panel');
  const header = el('header');
  const title = el('div', 'title', 'MARVIN');
  title.appendChild(el('span', '', '_'));
  const list = el('div', 'list');
  const input = el('textarea');
  input.placeholder = 'Écris ton message…';
  const footer = el('footer');
  panel.append(header, list, footer);
  root.append(style, panel);
  return { panel, header, title, list, input, footer };
}

/** Create the chat panel and mount it on document.body. */
export function createPanel(): ChatPanel {
  const host = el('div');
  const ui = buildSkeleton(host.attachShadow({ mode: 'closed' }));
  let sendCb: (text: string) => void = () => {};
  let newChatCb: () => void = () => {};
  let busyLine: HTMLElement | null = null;
  const pending = new Set<() => void>();
  const sendBtn = btn('Envoyer', () => submit(), 'primary');
  const newBtn = btn('Nouvelle discussion', () => newChatCb());
  const closeBtn = btn('✕', () => api.close());
  ui.header.append(ui.title, newBtn, closeBtn);
  ui.footer.append(ui.input, sendBtn);

  /** Append a node to the list and scroll to the bottom. */
  const push = <T extends HTMLElement>(node: T): T => {
    ui.list.appendChild(node);
    ui.list.scrollTop = ui.list.scrollHeight;
    return node;
  };
  /** Send the current input text if non-empty and not busy. */
  function submit(): void {
    const text = ui.input.value.trim();
    if (!text || ui.input.disabled) return;
    ui.input.value = '';
    sendCb(text);
  }
  ui.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  ui.panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.panel.classList.contains('open')) api.close();
  });

  const api: ChatPanel = {
    toggle: () => { ui.panel.classList.toggle('open'); },
    close: () => { ui.panel.classList.remove('open'); },
    onSend: (cb) => { sendCb = cb; },
    onNewChat: (cb) => { newChatCb = cb; },
    addMessage: (role, text) => { push(el('div', `msg ${role}`, text)); },
    clear: () => {
      pending.forEach((cancel) => cancel());
      ui.list.replaceChildren();
      busyLine = null;
      ui.input.disabled = false;
      sendBtn.disabled = false;
    },
    setBusy: (on) => {
      ui.input.disabled = on;
      sendBtn.disabled = on;
      busyLine?.remove();
      busyLine = on ? push(el('div', 'line busy', 'réflexion…')) : null;
    },
    showTool: (name) => { push(el('div', 'line tool', `outil : ${name}`)); },
    showError: (message, retry) => {
      const box = push(el('div', 'line error', message));
      const row = el('div', 'row');
      row.appendChild(btn('Réessayer', () => { box.remove(); retry(); }));
      box.appendChild(row);
    },
    confirm: (summary) => new Promise<boolean>((resolve) => {
      const box = push(el('div', 'line', summary));
      const done = (v: boolean) => { pending.delete(cancel); box.remove(); resolve(v); };
      const cancel = () => done(false);
      pending.add(cancel);
      const row = el('div', 'row');
      row.append(btn('Confirmer', () => done(true), 'primary'), btn('Annuler', () => done(false)));
      box.appendChild(row);
    }),
  };
  document.body.appendChild(host);
  return api;
}
