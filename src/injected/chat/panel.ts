/**
 * Chat panel UI mounted in a closed Shadow DOM. All text is rendered with textContent.
 */

import { toolLabel } from './toolLabels';

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

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel { position: fixed; top: 72px; right: 16px; width: 380px; height: 560px; max-height: calc(100vh - 96px);
  display: none; flex-direction: column; background: #141415; color: #ededed;
  border: 1px solid rgba(237,237,237,0.08); border-radius: 14px; z-index: 2147483000;
  font: 400 14px/20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums; box-shadow: 0 12px 32px rgba(0,0,0,0.35); }
.panel.open { display: flex; animation: in 200ms cubic-bezier(0.22,1,0.36,1); }
@keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
header { display: flex; align-items: center; gap: 4px; height: 48px; padding: 0 8px 0 16px; flex: none;
  border-bottom: 1px solid rgba(237,237,237,0.08); }
.title { font: 600 13px/16px ${MONO}; letter-spacing: 0.04em; flex: 1; }
.title span, .caret { color: #00ff97; }
button { font: inherit; border: 0; cursor: pointer; transition: background-color 150ms cubic-bezier(0.22,1,0.36,1),
  color 150ms cubic-bezier(0.22,1,0.36,1), border-color 150ms cubic-bezier(0.22,1,0.36,1), opacity 150ms; }
button:focus-visible { outline: 2px solid rgba(0,255,151,0.6); outline-offset: 2px; }
button svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5;
  stroke-linecap: round; stroke-linejoin: round; }
.icon { width: 32px; height: 32px; border-radius: 8px; padding: 0; display: grid; place-items: center;
  background: transparent; color: #a1a1a6; }
.icon:hover { background: #232325; color: #ededed; }
.list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
  scrollbar-width: thin; scrollbar-color: #2a2a2d transparent; }
.empty { font-size: 13px; line-height: 20px; color: #a1a1a6; }
.msg, .line { white-space: pre-wrap; word-break: break-word; }
.msg.user { align-self: flex-end; max-width: 85%; background: #232325; border-radius: 12px; padding: 8px 12px; }
.msg.assistant { align-self: stretch; color: #ededed; }
.tool { font: 400 12px/16px ${MONO}; color: #85858b; }
.tool + .tool { margin-top: -8px; }
.busy { font-size: 13px; color: #85858b; }
.caret { font-family: ${MONO}; animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.card { background: #19191b; border: 1px solid rgba(237,237,237,0.08); border-radius: 12px; padding: 12px; }
.row { display: flex; gap: 8px; margin-top: 12px; }
.action { height: 32px; padding: 0 12px; border-radius: 8px; font-size: 13px; font-weight: 500; }
.action.primary { background: #00ff97; color: #0b291d; }
.action.secondary { background: #232325; color: #ededed; border: 1px solid rgba(237,237,237,0.08); }
.error { font-size: 13px; color: #e5484d; }
.error .row { margin-top: 8px; }
.ghost { height: 28px; padding: 0 8px; border-radius: 6px; background: transparent; color: #a1a1a6; font-size: 13px; }
.ghost:hover { background: #232325; }
footer { padding: 12px; border-top: 1px solid rgba(237,237,237,0.08); flex: none; }
.box { position: relative; background: #19191b; border: 1px solid rgba(237,237,237,0.08); border-radius: 12px;
  transition: border-color 150ms cubic-bezier(0.22,1,0.36,1); }
.box:focus-within { border-color: rgba(237,237,237,0.16); }
textarea { display: block; width: 100%; resize: none; font: inherit; color: #ededed; background: transparent;
  border: 0; outline: 0; padding: 10px 52px 10px 12px; max-height: 120px; }
textarea::placeholder { color: #85858b; }
textarea:disabled { opacity: 0.5; }
.send { position: absolute; right: 4px; bottom: 4px; background: #00ff97; color: #0b291d; }
.send:hover { background: #00ff97; color: #0b291d; }
.send:disabled { background: #232325; color: #85858b; cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) {
  .panel.open { animation: none; }
  .caret { animation: none; }
  button, .box { transition: none; }
}
`;

const ICONS = {
  newChat: ['M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  send: ['m5 12 7-7 7 7', 'M12 19V5'],
};

/** Build a static 16px SVG icon from constant path strings. */
function icon(paths: string[]): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

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

/** Create an icon-only button with an accessible name and tooltip. */
function iconBtn(label: string, paths: string[], onClick: () => void, cls = 'icon'): HTMLButtonElement {
  const b = btn('', onClick, cls);
  b.setAttribute('aria-label', label);
  b.title = label;
  b.appendChild(icon(paths));
  return b;
}

/** Build the static panel skeleton inside the shadow root. */
function buildSkeleton(root: ShadowRoot) {
  const style = el('style');
  style.textContent = CSS;
  const panel = el('div', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Marvin');
  const header = el('header');
  const title = el('div', 'title', 'MARVIN');
  title.appendChild(el('span', '', '_'));
  const list = el('div', 'list');
  list.setAttribute('aria-live', 'polite');
  const empty = el('div', 'empty', 'Pose une question sur tes notes, tes crédits, tes projets ou ton planning');
  const input = el('textarea');
  input.rows = 1;
  input.placeholder = 'Écris ton message';
  const footer = el('footer');
  panel.append(header, list, footer);
  root.append(style, panel);
  return { panel, header, title, list, empty, input, footer };
}

/** Grow the textarea with its content, up to 120px. */
function autoGrow(input: HTMLTextAreaElement): void {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

/** Build the busy indicator line. */
function busyNode(): HTMLElement {
  const line = el('div', 'line busy', 'Marvin réfléchit');
  line.append(' ', el('span', 'caret', '_'));
  return line;
}

/** Build a confirm/cancel card for a summary. */
function confirmCard(summary: string, done: (v: boolean) => void): HTMLElement {
  const box = el('div', 'line card', summary);
  const row = el('div', 'row');
  row.append(btn('Confirmer', () => done(true), 'action primary'), btn('Annuler', () => done(false), 'action secondary'));
  box.appendChild(row);
  return box;
}

/** Create the chat panel and mount it on document.body. */
export function createPanel(): ChatPanel {
  const host = el('div');
  const ui = buildSkeleton(host.attachShadow({ mode: 'closed' }));
  let sendCb: (text: string) => void = () => {};
  let newChatCb: () => void = () => {};
  let busyLine: HTMLElement | null = null;
  const pending = new Set<() => void>();
  const sendBtn = iconBtn('Envoyer', ICONS.send, () => submit(), 'icon send');
  const newBtn = iconBtn('Nouvelle discussion', ICONS.newChat, () => newChatCb());
  const closeBtn = iconBtn('Fermer', ICONS.close, () => api.close());
  const box = el('div', 'box');
  box.append(ui.input, sendBtn);
  ui.header.append(ui.title, newBtn, closeBtn);
  ui.footer.append(box);
  ui.list.appendChild(ui.empty);

  /** Append a node to the list and scroll to the bottom. */
  const push = <T extends HTMLElement>(node: T): T => {
    ui.empty.remove();
    ui.list.appendChild(node);
    ui.list.scrollTop = ui.list.scrollHeight;
    return node;
  };
  /** Send the current input text if non-empty and not busy. */
  function submit(): void {
    const text = ui.input.value.trim();
    if (!text || ui.input.disabled) return;
    ui.input.value = '';
    autoGrow(ui.input);
    sendCb(text);
  }
  ui.input.addEventListener('input', () => autoGrow(ui.input));
  ui.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  ui.panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.panel.classList.contains('open')) api.close();
  });

  const api: ChatPanel = {
    toggle: () => {
      if (ui.panel.classList.toggle('open')) ui.input.focus();
    },
    close: () => { ui.panel.classList.remove('open'); },
    onSend: (cb) => { sendCb = cb; },
    onNewChat: (cb) => { newChatCb = cb; },
    addMessage: (role, text) => { push(el('div', `msg ${role}`, text)); },
    clear: () => {
      pending.forEach((cancel) => cancel());
      ui.list.replaceChildren(ui.empty);
      busyLine = null;
      ui.input.disabled = false;
      sendBtn.disabled = false;
    },
    setBusy: (on) => {
      ui.input.disabled = on;
      sendBtn.disabled = on;
      busyLine?.remove();
      busyLine = on ? push(busyNode()) : null;
    },
    showTool: (name) => { push(el('div', 'line tool', `› ${toolLabel(name)}`)); },
    showError: (message, retry) => {
      const err = push(el('div', 'line error', message));
      const row = el('div', 'row');
      row.appendChild(btn('Réessayer', () => { err.remove(); retry(); }, 'ghost'));
      err.appendChild(row);
    },
    confirm: (summary) => new Promise<boolean>((resolve) => {
      const done = (v: boolean) => { pending.delete(cancel); card.remove(); resolve(v); };
      const cancel = () => done(false);
      const card = push(confirmCard(summary, done));
      pending.add(cancel);
    }),
  };
  document.body.appendChild(host);
  return api;
}
