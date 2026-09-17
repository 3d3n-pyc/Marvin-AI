/**
 * @fileoverview Script d'injection principal exécuté dans le contexte d'exécution de la page MyEpitech (main world).
 * - Débloque l'interface native du chatbot Marvin pour les étudiants via un monkey-patching ciblé d'Array.prototype.includes.
 * - Intercepte les requêtes XHR relatives aux endpoints `/ai/chatbot/` et `/ai/quota/` pour émuler le backend MyEpitech en local.
 * - Intercepte les requêtes `window.fetch` pour remplacer le flux SSE officiel par une passerelle vers Ollama Cloud.
 * - Orchestre la boucle récursive d'exécution des outils (Function Calling) en injectant les résultats JSON en direct.
 * - Fournit des garde-fous de factualité, un horodatage dynamique précis et la persistance locale des conversations.
 * @module injected/page-hook
 */

import { TOOL_DEFINITIONS } from './definitions';
import { toolExecutors } from './tools';
import { getLocalConversations, saveLocalConversations } from './utils/conversations';
import { getBrowserTimeZone } from './utils/format';
import { initStudentStartersWatcher, STAFF_TO_STUDENT_PROMPT_MAP } from './utils/studentStarters';
import { generateFastTitle, generateAiTitle } from './utils/titleGenerator';
import { initChatInputWatcher } from './utils/chatInputLayout';
import { logger } from '../logger';
import type { ChatMessage, Conversation, OllamaChatPayload, OllamaChatResponse } from '../types';

(function () {
  'use strict';

  if ((window as any).__marvin_page_hook_installed) return;
  (window as any).__marvin_page_hook_installed = true;

  /** Nom du modèle LLM actif (synchronisé dynamiquement via le Content Script et la popup). */
  let activeModel = 'gemma4:31b';

  // Demander la configuration actuelle au content script
  window.postMessage({ type: 'MARVIN_GET_CONFIG_REQ' }, '*');

  window.addEventListener('message', (ev) => {
    if (ev.data && (ev.data.type === 'MARVIN_CONFIG_UPDATED' || ev.data.type === 'MARVIN_GET_CONFIG_RES')) {
      if (ev.data.model) {
        activeModel = ev.data.model;
      }
    }
  });

  // Masquer le sélecteur "niveau de réflexion" natif de l'interface qui n'est pas exploité par Ollama
  const hideThinkingStyle = document.createElement('style');
  hideThinkingStyle.id = 'marvin-hide-thinking-level';
  hideThinkingStyle.textContent = `
    [data-testid="chatbot-thinking-level"] {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(hideThinkingStyle);

  // Remplacer les pré-réponses staff par des suggestions orientées étudiant
  initStudentStartersWatcher();

  // Aligner le bouton d'envoi à droite et sur la même ligne quand le texte ne dépasse pas
  initChatInputWatcher();

  // =========================================================================
  // 1. HOOK SÉLECTIF Array.prototype.includes('student')
  // =========================================================================
  const origIncludes = Array.prototype.includes;
  Array.prototype.includes = function (search: any) {
    if (search === 'student') {
      const stack = new Error().stack || '';
      // Débloque le bouton Marvin <So /> et la modale <qi />
      if (/\b(Ss|Es)(?:\s*\(|@)/.test(stack) || (/\bCs\b/.test(stack) && window.innerWidth < 992)) {
        return false;
      }
    }
    return origIncludes.apply(this, arguments as any);
  };

  // =========================================================================
  // 2. INTERCEPTION XMLHttpRequest (pour Axios / React Query)
  // =========================================================================
  const OriginalXHR = window.XMLHttpRequest;

  /**
   * Constructeur XMLHttpRequest substitué pour intercepter et simuler les réponses de l'API Marvin.
   *
   * @this XMLHttpRequest
   * @returns Instance XMLHttpRequest instrumentée.
   */
  function PatchedXHR(this: XMLHttpRequest) {
    const xhr = new OriginalXHR();
    let _marvinUrl = '';
    let _marvinMethod = 'GET';

    const origOpen = xhr.open;
    xhr.open = function (method: string, url: string | URL) {
      _marvinMethod = (method || 'GET').toUpperCase();
      _marvinUrl = String(url);
      return origOpen.apply(xhr, arguments as any);
    };

    const origSend = xhr.send;
    xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      if (_marvinUrl.includes('/ai/chatbot/') || _marvinUrl.includes('/ai/quota/')) {
        handleMarvinXHR(xhr, _marvinMethod, _marvinUrl, body);
        return;
      }
      return origSend.apply(xhr, arguments as any);
    };

    return xhr;
  }

  /**
   * Traite et émule les requêtes XHR ciblant les routes `/ai/chatbot/` ou `/ai/quota/`.
   * Fournit la disponibilité illimitée et la gestion locale (CRUD) des conversations.
   *
   * @param xhr - Instance XHR sous-jacente.
   * @param method - Méthode HTTP exécutée (GET, POST, DELETE, etc.).
   * @param url - URL cible de la requête.
   * @param _body - Corps éventuel de la requête.
   */
  function handleMarvinXHR(xhr: XMLHttpRequest, method: string, url: string, _body: any) {
    setTimeout(() => {
      let responseData: any = null;
      const status = 200;

      // A) Disponibilité de Marvin
      if (url.includes('/ai/chatbot/availability')) {
        responseData = { enabled: true, unlimited: true, windows: [] };
      }
      // B) Quota IA
      else if (url.includes('/ai/quota/me')) {
        responseData = { unlimited: true, windows: [] };
      }
      // C) Discussions
      else if (url.includes('/ai/chatbot/conversations')) {
        const convs = getLocalConversations();
        const idMatch = url.match(/\/ai\/chatbot\/conversations\/([^\/\?]+)/);

        if (idMatch) {
          const convId = idMatch[1];
          if (method === 'DELETE') {
            const filtered = convs.filter((c) => c.id !== convId);
            saveLocalConversations(filtered);
            responseData = {};
          } else {
            const conv = convs.find((c) => c.id === convId);
            responseData = {
              id: convId,
              title: conv ? conv.title : 'Discussion',
              messages: (conv ? conv.messages : []).map((m) => ({
                role: m.role,
                content: m.content,
                toolCalls: m.toolCalls || []
              }))
            };
          }
        } else {
          if (method === 'POST') {
            const newId = 'conv_' + Date.now();
            const newConv: Conversation = {
              id: newId,
              title: 'Nouvelle discussion',
              preview: '',
              updatedAt: new Date().toISOString(),
              messages: []
            };
            convs.unshift(newConv);
            saveLocalConversations(convs);
            responseData = newConv;
          } else {
            responseData = {
              data: convs.map((c) => ({
                id: c.id,
                title: c.title,
                preview: c.preview,
                updatedAt: c.updatedAt,
                messageCount: c.messages ? c.messages.length : 0
              }))
            };
          }
        }
      }

      if (responseData === null) {
        responseData = { enabled: true, unlimited: true };
      }

      const responseText = JSON.stringify(responseData);
      let finalResponse = responseText;
      if (xhr.responseType === 'json') {
        finalResponse = responseData;
      }

      Object.defineProperties(xhr, {
        readyState: { value: 4, writable: true, configurable: true },
        status: { value: status, writable: true, configurable: true },
        statusText: { value: 'OK', writable: true, configurable: true },
        responseText: { value: responseText, writable: true, configurable: true },
        response: { value: finalResponse, writable: true, configurable: true }
      });

      (xhr as any).getAllResponseHeaders = () => 'content-type: application/json\r\n';
      (xhr as any).getResponseHeader = (h: string) =>
        h.toLowerCase() === 'content-type' ? 'application/json' : null;

      if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange(new Event('readystatechange'));
      xhr.dispatchEvent(new Event('readystatechange'));

      if (typeof xhr.onload === 'function') xhr.onload(new ProgressEvent('load'));
      xhr.dispatchEvent(new Event('load'));

      if (typeof xhr.onloadend === 'function') xhr.onloadend(new ProgressEvent('loadend'));
      xhr.dispatchEvent(new Event('loadend'));
    }, 5);
  }

  (window as any).XMLHttpRequest = PatchedXHR as any;

  // =========================================================================
  // 3. PASSERELLE POSTMESSAGE (Page -> Content Script -> Background)
  // =========================================================================
  /**
   * Transmet une requête d'inférence LLM au Content Script via l'API `window.postMessage`.
   * Le Content Script la relaie ensuite au Background Service Worker qui contacte Ollama Cloud.
   *
   * @param payload - Paramètres de requête de chat pour Ollama.
   * @returns Promesse résolue avec la réponse structurée d'Ollama.
   * @throws {Error} En cas d'erreur de communication ou d'échec de la requête.
   */
  function callOllamaBridge(payload: OllamaChatPayload): Promise<OllamaChatResponse> {
    return new Promise((resolve, reject) => {
      const callId = 'ollama_' + Math.random().toString(36).substring(2, 11);
      function handler(ev: MessageEvent) {
        if (ev.data && ev.data.type === 'MARVIN_OLLAMA_CALL_RES' && ev.data.id === callId) {
          window.removeEventListener('message', handler);
          if (ev.data.error) reject(new Error(ev.data.error));
          else resolve(ev.data.data);
        }
      }
      window.addEventListener('message', handler);
      window.postMessage({ type: 'MARVIN_OLLAMA_CALL_REQ', id: callId, payload }, '*');
    });
  }

  // =========================================================================
  // 4. INTERCEPTION window.fetch (SSE Streaming vers Ollama Cloud)
  // =========================================================================
  const origFetch = window.fetch;
  let lastMessageTrack = { convId: '', content: '', time: 0 };

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : (input as Request)?.url || '';

    if (url.includes('/ai/chatbot/conversations/') && url.endsWith('/messages')) {
      const idMatch = url.match(/\/conversations\/([^\/]+)\/messages/);
      const convId = idMatch ? idMatch[1] : 'conv_default';

      let bodyData: any = {};
      try {
        bodyData = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body || {};
      } catch {}

      let userContent = bodyData.content || '';
      if (STAFF_TO_STUDENT_PROMPT_MAP[userContent]) {
        userContent = STAFF_TO_STUDENT_PROMPT_MAP[userContent];
      }
      const fullPageContext = window.location.pathname + (window.location.search || '');
      const pageContext = bodyData.pageContext || fullPageContext;

      // Protection anti-doublon (si deux requêtes identiques arrivent dans les 800ms)
      const now = Date.now();
      if (
        lastMessageTrack.convId === convId &&
        lastMessageTrack.content === userContent &&
        now - lastMessageTrack.time < 800
      ) {
        logger.warn('Requête en double ignorée :', userContent);
        const dummyStream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
            controller.close();
          }
        });
        return new Response(dummyStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' }
        });
      }
      lastMessageTrack = { convId, content: userContent, time: now };

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          /**
           * Émet un événement Server-Sent Events (SSE) standard vers le client React de MyEpitech.
           *
           * @param type - Nom de l'événement SSE (ex: 'tool_call', 'delta', 'done').
           * @param dataObj - Données associées sérialisées en JSON.
           */
          function sendEvent(type: string, dataObj: any) {
            const text = `event: ${type}\ndata: ${JSON.stringify(dataObj)}\n\n`;
            controller.enqueue(encoder.encode(text));
          }

          try {
            const convs = getLocalConversations();
            let conv = convs.find((c) => c.id === convId);
            const isFirstMessage = !conv || conv.messages.filter((m) => m.role === 'user').length === 0;

            if (!conv) {
              conv = {
                id: convId,
                title: generateFastTitle(userContent),
                preview: userContent.slice(0, 60),
                updatedAt: new Date().toISOString(),
                messages: []
              };
              convs.unshift(conv);
              saveLocalConversations(convs);
            } else if (isFirstMessage || conv.title === 'Nouvelle discussion' || conv.title === 'Discussion') {
              conv.title = generateFastTitle(userContent);
              conv.preview = userContent.slice(0, 60);
              conv.updatedAt = new Date().toISOString();
              saveLocalConversations(convs);
            }

            const tz = getBrowserTimeZone();
            const nowDate = new Date();
            const todayISO = nowDate.toISOString().slice(0, 10);
            const currentTime = nowDate.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: tz
            });
            const currentTimeWithSec = nowDate.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZone: tz
            });
            const tomorrowDate = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);
            const tomorrowISO = tomorrowDate.toISOString().slice(0, 10);
            const todayFr = nowDate.toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: tz
            });
            const tomorrowFr = tomorrowDate.toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: tz
            });

            const ollamaMessages: ChatMessage[] = [
              {
                role: 'system',
                content: `Tu es Marvin, l'assistant officiel de MyEpitech. Réponds en français de manière claire, naturelle, structurée et concise.
Date et heure actuelles : ${todayFr} (${todayISO}) à ${currentTime} (heure précise : ${currentTimeWithSec}).
Demain : ${tomorrowFr} (${tomorrowISO}).
Fuseau horaire : ${tz}.
Tu as accès à des outils pour consulter et agir en direct sur les données officielles de l'étudiant :
- getUnitRegistrations : À APPELER SYSTÉMATIQUEMENT dès que l'étudiant demande à quels modules, cours ou unités d'enseignement il est inscrit (ex: "Je suis inscrit à quels modules ?", "Quels sont mes cours ?", "Est-ce que je suis inscrit à X ?"). ATTENTION : Ne confonds JAMAIS les devoirs/projets (comme 'Survivor', 'Bloodhound', 'Dashboard', ou tracks AWS) avec les MODULES/unités d'enseignement (comme 'B-INN-000 - Innovation Hub', 'G-ENG-500 - G3 - English', 'G-WEB-500 - Full-Stack Web Development', 'S-INN-000 - User Group - AWS', etc.). Quand on te demande la liste de ses modules, présente-les toujours de manière structurée par catégorie (Modules du semestre, Modules annuels & Hub/User Groups, Expérience pro) en indiquant le code et le nom officiel.
- getProjects : projets et devoirs en cours et récents (deadlines de rendu, jours restants, composition du groupe, coéquipiers et lien Hermes). N'utilise pas cet outil pour lister les modules/cours d'un étudiant.
- getUpcomingEvents : consulte le planning et l'emploi du temps officiel (cours, kick-offs, soutenances, examens). Les horaires ('horaire', 'heure_debut', 'heure_fin') sont DÉJÀ convertis dans le fuseau horaire local (${tz}) et incluent automatiquement l'heure de passage individuelle réservée pour les activités à créneaux. Mentionne systématiquement la salle ('salle') et l'intervenant.
- getEvaluations : récupère les notes, évaluations, soutenances, retours détaillés des jurys/professeurs et commentaires. Utilise cet outil dès que l'étudiant demande ses notes ou ses retours de soutenance.
- getLogtime : heures de logtime des 14 derniers jours avec synthèse de la semaine (total étudiant, moyenne quotidienne, total promo et avance/retard par rapport à la promo).
- getArgosTests : consulte les résultats officiels de la moulinette Argos sur les projets (tests réussis/échoués, pourcentage de réussite, crashs, erreurs de coding style/norme Epitech).
- getAbsences : bilan d'absences par projet (taux d'absence %, risque de défaillance) et liste des séances manquées non justifiées.
- getAcademicValidations : crédits ECTS acquis, seuil de passage de l'année, crédits manquants, blocs de compétences et examens certifiants (TEPitech).
- getStudentProfile : profil de l'étudiant (nom, prénom, login, campus, promo, cursus, semestre, GPA).
- getGamification : solde XP, niveau, série de jours consécutifs (streak) et vies restantes.
- getNotifications : notifications récentes (nouvelles notes, changements de salle ou d'horaire, invitations de groupe).
- confirmAttendance : valide la présence de l'étudiant à une séance en cours à l'aide du code à 4 chiffres (ex: '4821').
- getProjectInvitations & respondProjectInvitation : consulte et accepte/refuse les invitations reçues pour rejoindre un groupe de projet.
- getCollaborators : camarades de promo avec qui l'étudiant a le plus souvent travaillé en binôme/groupe et leurs projets communs.
- getEventRegistrations : liste des camarades inscrits à une séance du planning (pour savoir qui est inscrit avec soi).
- getEventSlots : liste complète des créneaux (slots) de rendez-vous d'un événement, ordre chronologique de passage et camarades inscrits (qui passe avant ou après l'étudiant). À APPELER dès qu'une question porte sur les passages ("Qui passe avant moi ?", "Et avant ?", "À quelle heure ?").
RÈGLES D'OR DE FACTUALITÉ :
1. Ne JAMAIS inventer de noms d'étudiants, d'horaires, de créneaux ou de données académiques.
2. Si une question de suivi porte sur un créneau ou un ordre de passage ("Et avant ?", "Qui passe après ?", "À quelle heure ?") et que le nom précis n'est pas dans l'historique, appelle OBLIGATOIREMENT l'outil getEventSlots.
3. Ne dis JAMAIS "je viens de vérifier" si tu n'as pas réellement appelé un outil.
Contexte de navigation actuel : ${pageContext}.`
              },
              ...(conv ? conv.messages : []).flatMap((m) => {
                if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
                  return [
                    {
                      role: 'assistant' as const,
                      content: m.content || '',
                      tool_calls: m.toolCalls.map((tc: any) => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                          name: tc.name,
                          arguments: tc.arguments
                        }
                      }))
                    },
                    ...m.toolCalls.map((tc: any) => ({
                      role: 'tool' as const,
                      content: JSON.stringify(tc.result)
                    }))
                  ];
                }
                return [{ role: m.role, content: m.content || '' }];
              }),
              {
                role: 'user',
                content: userContent
              }
            ];

            const executedToolCalls: any[] = [];

            /**
             * Exécute récursivement les cycles de dialogue avec le modèle Ollama.
             * Détecte les `tool_calls`, exécute les fonctions associées, réinjecte les résultats
             * et relance l'inférence jusqu'à obtention de la réponse finale de l'assistant.
             *
             * @returns Promesse résolue une fois la génération et l'enregistrement terminés.
             */
            async function executeOllamaCycle(): Promise<void> {
              const resp = await callOllamaBridge({
                model: activeModel,
                messages: ollamaMessages,
                tools: TOOL_DEFINITIONS,
                stream: false,
                options: {
                  temperature: 0.1,
                  top_p: 0.9,
                  num_ctx: 8192
                }
              });

              const assistantMsg = resp.message;
              if (!assistantMsg) throw new Error("Réponse vide reçue d'Ollama Cloud");

              // Exécution des tool calls
              if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
                ollamaMessages.push(assistantMsg as ChatMessage);

                for (const call of assistantMsg.tool_calls) {
                  const callId = call.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                  const fnName = call.function.name;
                  const fnArgs = typeof call.function.arguments === 'string'
                    ? JSON.parse(call.function.arguments || '{}')
                    : (call.function.arguments || {});

                  sendEvent('tool_call', { id: callId, name: fnName, arguments: fnArgs });

                  let result: any;
                  let ok = true;
                  try {
                    if (toolExecutors[fnName]) {
                      result = await toolExecutors[fnName](fnArgs);
                    } else {
                      result = { error: `Outil non supporté : ${fnName}` };
                      ok = false;
                    }
                  } catch (e: any) {
                    result = { error: e.message };
                    ok = false;
                  }

                  executedToolCalls.push({
                    id: callId,
                    name: fnName,
                    arguments: fnArgs,
                    status: ok ? 'executed' : 'failed',
                    result
                  });

                  sendEvent('tool_result', { toolCallId: callId, ok, result });

                  ollamaMessages.push({
                    role: 'tool',
                    content: JSON.stringify(result)
                  });
                }

                return executeOllamaCycle();
              }

              // Message final de l'assistant
              if (assistantMsg.content) {
                sendEvent('delta', { delta: assistantMsg.content });
              }

              // Sauvegarde atomique de l'échange (utilisateur + assistant)
              const latestConvs = getLocalConversations();
              let targetConv = latestConvs.find((c) => c.id === convId);
              if (!targetConv) {
                targetConv = {
                  id: convId,
                  title: generateFastTitle(userContent),
                  preview: '',
                  updatedAt: new Date().toISOString(),
                  messages: []
                };
                latestConvs.unshift(targetConv);
              }

              // Génération contextuelle du titre par IA pour le premier message
              if (isFirstMessage) {
                try {
                  const aiTitle = await generateAiTitle(
                    userContent,
                    activeModel,
                    callOllamaBridge,
                    assistantMsg.content
                  );
                  if (aiTitle) {
                    targetConv.title = aiTitle;
                  }
                } catch {}
              }

              targetConv.messages.push({ role: 'user', content: userContent });
              if (assistantMsg.content) {
                targetConv.messages.push({
                  role: 'assistant',
                  content: assistantMsg.content,
                  toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined
                });
                targetConv.preview = assistantMsg.content.slice(0, 80);
              }
              targetConv.updatedAt = new Date().toISOString();
              saveLocalConversations(latestConvs);

              sendEvent('done', {});
              controller.close();
            }

            await executeOllamaCycle();
          } catch (err: any) {
            try {
              const latestConvs = getLocalConversations();
              const targetConv = latestConvs.find((c) => c.id === convId);
              if (targetConv) {
                targetConv.messages.push({ role: 'user', content: userContent });
                targetConv.messages.push({
                  role: 'assistant',
                  content: `⚠️ Erreur : ${err.message || 'Une erreur est survenue'}`
                });
                saveLocalConversations(latestConvs);
              }
            } catch {}

            sendEvent('error', { message: err.message });
            controller.close();
          }
        }
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Approbations d'outils
    if (url.includes('/ai/chatbot/conversations/') && url.endsWith('/approvals')) {
      const approvalStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
          controller.close();
        }
      });
      return new Response(approvalStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      });
    }

    return origFetch.apply(this, arguments as any);
  };

  // =========================================================================
  // 5. BOUTON NAVBAR FALLBACK
  // =========================================================================
  /**
   * Recherche l'instance du contrôleur de modale React interne de MyEpitech
   * en explorant l'arborescence des React Fiber nodes dans le DOM.
   *
   * @returns Contrôleur de modale React disposant des méthodes `open` et `toggle`, ou `null`.
   */
  function getChatbotController() {
    const el = document.querySelector('header') || document.getElementById('root');
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
    if (!key) return null;
    let fiber = (el as any)[key];
    while (fiber) {
      const val = fiber.memoizedProps?.value;
      if (val && typeof val.toggle === 'function' && typeof val.open === 'function') {
        return val;
      }
      fiber = fiber.return;
    }
    return null;
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
      const ctrl = getChatbotController();
      if (ctrl) {
        ctrl.toggle();
      } else {
        logger.warn('Chatbot controller non encore prêt');
      }
    };

    actionsContainer.prepend(btn);
  }, 500);
})();
