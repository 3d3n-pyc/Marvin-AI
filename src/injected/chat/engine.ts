/**
 * @fileoverview Moteur de chat Marvin : prompt système, historique et boucle d'outils.
 * @module injected/chat/engine
 */

import { TOOL_DEFINITIONS } from '../definitions';
import { toolExecutors } from '../tools';
import { getLocalConversations, saveLocalConversations } from '../utils/conversations';
import { getBrowserTimeZone } from '../utils/format';
import { generateFastTitle, generateAiTitle } from '../utils/titleGenerator';
import { callOllama } from './bridge';
import type { ChatMessage, Conversation } from '../../types';

/** Callbacks fournis par l'interface au moteur de chat. */
export interface ChatHooks {
  onTool(name: string): void;
  confirm(summary: string): Promise<boolean>;
}

/** Message d'erreur affiché quand la clé blade.sh n'est pas configurée. */
const HOST_PERMISSION_MESSAGE = "Accès à blade.sh non autorisé : ouvre le popup de l'extension et clique sur « Autoriser l'accès à blade.sh »";
const NETWORK_MESSAGE = 'blade.sh injoignable : vérifie ta connexion puis réessaie';
const MISSING_KEY_MESSAGE = "clé manquante : renseigne ta clé blade.sh dans le popup de l'extension";

/** Nombre maximal de cycles d'outils pour éviter une boucle infinie. */
const MAX_TOOL_CYCLES = 10;

/** Nom du modèle LLM actif (synchronisé via le Content Script). */
let activeModel = 'olala-v1.0-mini-7a1b';

window.addEventListener('message', (ev) => {
  const type = ev.data && ev.data.type;
  if ((type === 'MARVIN_CONFIG_UPDATED' || type === 'MARVIN_GET_CONFIG_RES') && ev.data.model) {
    activeModel = ev.data.model;
  }
});
window.postMessage({ type: 'MARVIN_GET_CONFIG_REQ' }, '*');

/**
 * Formate une date en français dans un fuseau horaire.
 *
 * @param d - Date à formater.
 * @param tz - Fuseau horaire IANA.
 * @returns Date longue (ex: "lundi 3 mars 2025").
 */
function formatDateFr(d: Date, tz: string): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz
  });
}

/**
 * Construit le prompt système de Marvin (date, fuseau, outils, règles de factualité).
 *
 * @param pageContext - Chemin de navigation actuel.
 * @param nowDate - Date courante (injectable pour les tests).
 * @returns Texte du prompt système.
 */
export function buildSystemPrompt(pageContext: string, nowDate: Date = new Date()): string {
  const tz = getBrowserTimeZone();
  const todayISO = nowDate.toISOString().slice(0, 10);
  const timeOpts = { hour: '2-digit', minute: '2-digit', timeZone: tz } as const;
  const currentTime = nowDate.toLocaleTimeString('fr-FR', timeOpts);
  const currentTimeWithSec = nowDate.toLocaleTimeString('fr-FR', { ...timeOpts, second: '2-digit' });
  const tomorrowDate = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowISO = tomorrowDate.toISOString().slice(0, 10);
  const todayFr = formatDateFr(nowDate, tz);
  const tomorrowFr = formatDateFr(tomorrowDate, tz);
  return `Tu es Marvin, l'assistant officiel de MyEpitech. Réponds en français de manière claire, naturelle, structurée et concise.
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
Contexte de navigation actuel : ${pageContext}.`;
}

/**
 * Convertit un message stocké en message(s) au format Ollama (avec tool_calls et résultats).
 *
 * @param m - Message de conversation persisté.
 * @returns Un ou plusieurs messages Ollama.
 */
function mapStoredMessage(m: any): ChatMessage[] {
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return [
      {
        role: 'assistant',
        content: m.content || '',
        tool_calls: m.toolCalls.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments }
        }))
      },
      ...m.toolCalls.map((tc: any) => ({ role: 'tool' as const, content: JSON.stringify(tc.result) }))
    ];
  }
  return [{ role: m.role, content: m.content || '' }];
}

/**
 * Convertit l'historique persisté d'une conversation en messages Ollama.
 *
 * @param messages - Messages persistés de la conversation.
 * @returns Messages au format Ollama.
 */
export function toOllamaHistory(messages: any[]): ChatMessage[] {
  return messages.flatMap(mapStoredMessage);
}

/**
 * Récupère ou crée la conversation ciblée et met à jour son titre rapide si nécessaire.
 *
 * @param convId - Identifiant de la conversation.
 * @param text - Premier message utilisateur (pour le titre).
 * @returns Conversation et indicateur de premier message.
 */
function ensureConversation(convId: string, text: string): { conv: Conversation; isFirst: boolean } {
  const convs = getLocalConversations();
  let conv = convs.find((c) => c.id === convId);
  const isFirst = !conv || conv.messages.filter((m) => m.role === 'user').length === 0;
  if (!conv) {
    conv = { id: convId, title: generateFastTitle(text), preview: text.slice(0, 60), updatedAt: new Date().toISOString(), messages: [] };
    convs.unshift(conv);
    saveLocalConversations(convs);
  } else if (isFirst || conv.title === 'Nouvelle discussion' || conv.title === 'Discussion') {
    conv.title = generateFastTitle(text);
    conv.preview = text.slice(0, 60);
    conv.updatedAt = new Date().toISOString();
    saveLocalConversations(convs);
  }
  return { conv, isFirst };
}

/**
 * Appelle Ollama en traduisant l'erreur de clé manquante en message lisible.
 *
 * @param messages - Messages à envoyer.
 * @returns Réponse d'Ollama.
 * @throws {Error} Clé manquante ou erreur du bridge.
 */
async function chatCall(messages: ChatMessage[]): Promise<any> {
  try {
    return await callOllama({
      model: activeModel,
      messages,
      tools: TOOL_DEFINITIONS,
      stream: false,
      options: { temperature: 0.1, top_p: 0.9, num_ctx: 8192 }
    });
  } catch (e: any) {
    throw new Error(mapChatError(e && e.message));
  }
}

/** Réponse de repli quand le modèle renvoie un texte final vide. */
export const EMPTY_REPLY_FALLBACK = "Je n'ai pas pu générer de réponse, réessaie.";

/**
 * Traduit un code d'erreur du background en message français lisible.
 *
 * @param message - Message d'erreur brut.
 * @returns Message français, ou le message d'origine s'il est inconnu.
 */
export function mapChatError(message: unknown): string {
  const raw = String(message);
  if (raw.includes('MISSING_API_KEY')) return MISSING_KEY_MESSAGE;
  if (raw.includes('HOST_PERMISSION_MISSING')) return HOST_PERMISSION_MESSAGE;
  if (raw.includes('NETWORK_ERROR')) return NETWORK_MESSAGE;
  return raw;
}

/**
 * Retourne le texte final à enregistrer, avec un repli si la réponse est vide.
 *
 * @param reply - Contenu brut renvoyé par le modèle.
 * @returns Réponse non vide.
 */
export function normalizeReply(reply: unknown): string {
  return typeof reply === 'string' && reply.trim() ? reply : EMPTY_REPLY_FALLBACK;
}

/**
 * Analyse les arguments d'un tool_call sans jamais lever d'exception.
 *
 * @param raw - Arguments bruts (chaîne JSON ou objet).
 * @returns Objet d'arguments, ou null si invalide.
 */
export function parseToolArgs(raw: unknown): Record<string, any> | null {
  try {
    const val = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
    return val && typeof val === 'object' && !Array.isArray(val) ? val : null;
  } catch {
    return null;
  }
}

/**
 * Cherche le nom du projet d'une invitation dans les résultats d'outils déjà obtenus.
 *
 * @param executed - Journal des appels d'outils exécutés.
 * @param memberId - Identifiant de l'invitation.
 * @returns Nom du projet ou undefined.
 */
function findInvitationProject(executed: any[], memberId: unknown): string | undefined {
  for (const e of executed) {
    if (e.name !== 'getProjectInvitations' || !Array.isArray(e.result)) continue;
    const inv = e.result.find((i: any) => String(i && i.memberId) === String(memberId));
    if (inv && inv.projet) return String(inv.projet);
  }
  return undefined;
}

/**
 * Résume en français l'action sensible demandée, ou null si l'outil ne nécessite pas de confirmation.
 *
 * @param name - Nom de l'outil.
 * @param args - Arguments de l'outil.
 * @param executed - Journal des appels déjà exécutés (pour retrouver le projet d'une invitation).
 * @returns Résumé court ou null.
 * @throws {Error} Action d'invitation inconnue.
 */
export function confirmSummary(name: string, args: any, executed: any[] = []): string | null {
  if (name === 'confirmAttendance') {
    const event = args.eventId ? `l'événement n°${args.eventId}` : "l'événement du jour";
    return `Valider ta présence à ${event} avec le code ${args.code}`;
  }
  if (name === 'respondProjectInvitation') {
    const verbs: Record<string, string> = { accept: 'Accepter', decline: 'Refuser', refuse: 'Refuser' };
    const verb = verbs[String(args.action)];
    if (!verb) throw new Error(`Action d'invitation invalide : ${args.action}`);
    const project = args.projectName || findInvitationProject(executed, args.memberId);
    return `${verb} l'invitation de groupe n°${args.memberId}${project ? ` (projet ${project})` : ''}`;
  }
  return null;
}

/**
 * Exécute un outil (après confirmation éventuelle) et renvoie son résultat.
 *
 * @param name - Nom de l'outil.
 * @param args - Arguments de l'outil.
 * @param hooks - Callbacks UI.
 * @param executed - Journal des appels déjà exécutés.
 * @returns Résultat et indicateur de succès.
 */
async function execTool(name: string, args: any, hooks: ChatHooks, executed: any[]): Promise<{ result: any; ok: boolean }> {
  try {
    const summary = confirmSummary(name, args, executed);
    if (summary && !(await hooks.confirm(summary))) {
      return { result: { error: "L'utilisateur a refusé cette action." }, ok: false };
    }
    if (!toolExecutors[name]) return { result: { error: `Outil non supporté : ${name}` }, ok: false };
    return { result: await toolExecutors[name](args), ok: true };
  } catch (e: any) {
    return { result: { error: e.message }, ok: false };
  }
}

/**
 * Exécute les tool_calls d'un message assistant, alimente l'historique et le journal d'exécution.
 * Un appel mal formé produit un résultat d'erreur pour le modèle au lieu de lever.
 *
 * @param calls - tool_calls émis par le modèle.
 * @param messages - Historique Ollama (muté).
 * @param executed - Journal des appels exécutés (muté).
 * @param hooks - Callbacks UI.
 */
export async function runToolCalls(calls: any[], messages: ChatMessage[], executed: any[], hooks: ChatHooks): Promise<void> {
  for (const call of calls) {
    const id = call?.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const name = call?.function?.name;
    const args = name ? parseToolArgs(call.function.arguments) : null;
    if (!name || !args) {
      messages.push({ role: 'tool', content: JSON.stringify({ error: 'arguments invalides' }) });
      continue;
    }
    hooks.onTool(name);
    const { result, ok } = await execTool(name, args, hooks, executed);
    executed.push({ id, name, arguments: args, status: ok ? 'executed' : 'failed', result });
    messages.push({ role: 'tool', content: JSON.stringify(result) });
  }
}

/**
 * Enregistre l'échange (utilisateur + assistant) dans la conversation, avec titre IA au premier message.
 *
 * @param convId - Identifiant de la conversation.
 * @param text - Message utilisateur.
 * @param reply - Réponse finale de l'assistant.
 * @param executed - Appels d'outils exécutés.
 * @param isFirst - Vrai si c'est le premier message.
 */
async function saveExchange(convId: string, text: string, reply: string, executed: any[], isFirst: boolean): Promise<void> {
  const convs = getLocalConversations();
  let conv = convs.find((c) => c.id === convId);
  if (!conv) {
    conv = { id: convId, title: generateFastTitle(text), preview: '', updatedAt: '', messages: [] };
    convs.unshift(conv);
  }
  if (isFirst) {
    try {
      const aiTitle = await generateAiTitle(text, activeModel, callOllama, reply);
      if (aiTitle) conv.title = aiTitle;
    } catch {}
  }
  conv.messages.push({ role: 'user', content: text });
  conv.messages.push({ role: 'assistant', content: reply, toolCalls: executed.length > 0 ? executed : undefined });
  conv.preview = reply.slice(0, 80);
  conv.updatedAt = new Date().toISOString();
  saveLocalConversations(convs);
}

/**
 * Traite un message utilisateur : exécute la boucle d'outils et persiste l'échange.
 *
 * @param text - Message de l'utilisateur.
 * @param convId - Identifiant de la conversation.
 * @param hooks - Callbacks UI (outil en cours, confirmation).
 * @returns Texte final de l'assistant.
 * @throws {Error} Clé manquante, réponse vide ou erreur réseau.
 */
export async function runChat(text: string, convId: string, hooks: ChatHooks): Promise<string> {
  const { conv, isFirst } = ensureConversation(convId, text);
  const pageContext = window.location.pathname + (window.location.search || '');
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(pageContext) },
    ...toOllamaHistory(conv.messages),
    { role: 'user', content: text }
  ];
  const executed: any[] = [];
  for (let i = 0; i < MAX_TOOL_CYCLES; i++) {
    const msg = (await chatCall(messages)).message;
    if (!msg) throw new Error("Réponse vide reçue d'Ollama Cloud");
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const reply = normalizeReply(msg.content);
      await saveExchange(convId, text, reply, executed, isFirst);
      return reply;
    }
    messages.push(msg as ChatMessage);
    await runToolCalls(msg.tool_calls, messages, executed, hooks);
  }
  throw new Error("Trop d'appels d'outils successifs");
}
