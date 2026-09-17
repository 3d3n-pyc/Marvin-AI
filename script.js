// ==UserScript==
// @name         MyEpitech - Marvin Officiel Débloqué (Ollama Cloud)
// @namespace    https://my.epitech.eu/
// @version      3.8.0
// @description  Débloque l'interface Marvin native officielle dans MyEpitech (sans forcer l'interface staff) et la connecte à Ollama Cloud
// @match        https://my.epitech.eu/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      ollama.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // --- Configuration ---
  const API_KEY = "6f2da7f4d267499fbb04942ed13e5ab7.WtJebKG8DaWx6yr5zReQrZ37";
  const MODEL_NAME = "gemma4:31b";
  const STORAGE_KEY = "marvin_official_conversations";

  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // --- Passerelle Tampermonkey vers Ollama Cloud (GM_xmlhttpRequest sans CORS) ---
  function callOllamaViaGM(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://ollama.com/api/chat",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        data: JSON.stringify(payload),
        onload: function (resp) {
          if (resp.status >= 200 && resp.status < 300) {
            try {
              resolve(JSON.parse(resp.responseText));
            } catch (err) {
              reject(new Error("Format JSON invalide reçu d'Ollama"));
            }
          } else {
            let errorMsg = `HTTP ${resp.status}`;
            try {
              const j = JSON.parse(resp.responseText);
              errorMsg = j.error || j.message || errorMsg;
            } catch {}
            reject(new Error(errorMsg));
          }
        },
        onerror: function () {
          reject(new Error("Connexion réseau impossible vers https://ollama.com"));
        }
      });
    });
  }

  // Expose la passerelle à la page
  win.__marvinOllamaBridge = callOllamaViaGM;

  // Fallback postMessage pour Firefox/sandbox renforcée
  window.addEventListener('message', async (e) => {
    if (e.data && e.data.type === 'MARVIN_OLLAMA_CALL_REQ') {
      try {
        const res = await callOllamaViaGM(e.data.payload);
        window.postMessage({ type: 'MARVIN_OLLAMA_CALL_RES', id: e.data.id, data: res }, '*');
      } catch (err) {
        window.postMessage({ type: 'MARVIN_OLLAMA_CALL_RES', id: e.data.id, error: err.message }, '*');
      }
    }
  });

  // --- Code principal d'interception exécuté dans la page ---
  function mainPageHook() {
    if (window.__marvin_page_hook_installed) return;
    window.__marvin_page_hook_installed = true;

    const STORAGE_KEY = "marvin_official_conversations";
    const MODEL_NAME = "gemma4:31b";

    // Gestion des conversations locales
    function getLocalConversations() {
      try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (Array.isArray(data) && data.length > 0) return data;
      } catch {}

      const initial = [{
        id: "conv_default",
        title: "Bienvenue sur Marvin",
        preview: "Bonjour ! Je suis Marvin...",
        updatedAt: new Date().toISOString(),
        messages: [{
          role: "assistant",
          content: `Bonjour ! Je suis Marvin, l'assistant officiel de MyEpitech connecté à Ollama Cloud (${MODEL_NAME}).\n\nJe peux consulter en direct tes notes, ton logtime, tes projets et ton planning. Que souhaites-tu savoir ?`,
          toolCalls: []
        }]
      }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    function saveLocalConversations(convs) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
    }

    // Helpers API Epitech pour l'exécution des Tools
    function getEpitechToken() {
      try {
        const acc = JSON.parse(localStorage.getItem('@account'));
        return acc?.token || null;
      } catch {
        return null;
      }
    }

    async function fetchEpitech(endpoint) {
      const token = getEpitechToken();
      const headers = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api${endpoint}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }

    function parseDurationToHours(str) {
      if (!str) return 0;
      const m = str.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
      if (!m) return 0;
      const s = (parseFloat(m[1]||0)*3600) + (parseFloat(m[2]||0)*60) + parseFloat(m[3]||0);
      return Math.round((s / 3600) * 10) / 10;
    }

    function getBrowserTimeZone() {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
      } catch {
        return 'Europe/Paris';
      }
    }

    function formatLocalTime(isoStr) {
      if (!isoStr) return "";
      try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: getBrowserTimeZone()
        });
      } catch {
        return isoStr;
      }
    }

    function formatLocalDate(isoStr) {
      if (!isoStr) return "";
      try {
        const d = new Date(isoStr);
        return d.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: getBrowserTimeZone()
        });
      } catch {
        return isoStr;
      }
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "getMarks",
          description: "Récupère les notes officielles de l'étudiant à tous ses examens, soutenances, projets et activités (note, titre de l'activité, date, évaluateur, commentaire)",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "getCredits",
          description: "Récupère le total des crédits ECTS acquis par l'étudiant (crédits acquis, crédits antérieurs, total)",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "getAcademicValidations",
          description: "Récupère le tableau de bord des validations académiques par bloc de compétences, modules et semestres",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "getStudentProfile",
          description: "Récupère le profil de l'étudiant (nom, prénom, login, campus, promo, GPA, semestre)",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "getLogtime",
          description: "Récupère les heures de logtime des 14 derniers jours avec les heures réelles et la moyenne de promo",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "getProjects",
          description: "Récupère la liste des projets récents et en cours avec dates de début, fin et statut",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "getUpcomingEvents",
          description: "Consulte le planning et l'emploi du temps officiel de l'étudiant (cours, soutenances, kick-offs, examens, créneaux) pour aujourd'hui, demain ou les prochains jours",
          parameters: {
            type: "object",
            properties: {
              daysAhead: {
                type: "number",
                description: "Nombre de jours à récupérer à partir d'aujourd'hui (1 pour aujourd'hui, 2 pour demain inclus, 7 pour toute la semaine. Par défaut: 7)"
              },
              targetDate: {
                type: "string",
                description: "Date de départ au format YYYY-MM-DD si l'étudiant demande un jour précis"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getNotifications",
          description: "Récupère les notifications récentes (notes publiées, retours d'évaluation)",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "getGamification",
          description: "Récupère le niveau XP, la balance de points XP et la série (streak) de jours consécutifs de l'étudiant",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "getUnitRegistrations",
          description: "Consulte les inscriptions à une unité d'enseignement / module (ex: G-ADM-500, G-PRO-500), confirme si l'étudiant y est officiellement inscrit et affiche les détails (date d'inscription, total d'étudiants inscrits, etc.)",
          parameters: {
            type: "object",
            properties: {
              unitCode: {
                type: "string",
                description: "Code du module (ex: G-ADM-500, G-PRO-500)"
              },
              schoolYear: {
                type: "number",
                description: "Année scolaire du module (optionnel, par défaut 2026)"
              },
              instanceCode: {
                type: "string",
                description: "Code de l'instance du campus (optionnel, ex: LIL-1)"
              }
            },
            required: ["unitCode"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getEventSlots",
          description: "Consulte la liste détaillée des créneaux (slots) d'un événement du planning (ex: suivi individuel, soutenance) avec les créneaux disponibles et le créneau précis réservé par l'étudiant",
          parameters: {
            type: "object",
            properties: {
              eventId: {
                type: "number",
                description: "ID numérique de l'événement (ex: 22394)"
              }
            },
            required: ["eventId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getEventRegistrations",
          description: "Récupère la liste de tous les étudiants (camarades de promo) inscrits à un événement ou cours du planning (ex: kick-off, cours, soutenance). Utilise systématiquement cet outil quand l'étudiant demande 'qui est inscrit avec moi' ou qui participe à une session !",
          parameters: {
            type: "object",
            properties: {
              eventId: {
                type: "number",
                description: "ID numérique de l'événement (ex: 22280)"
              },
              search: {
                type: "string",
                description: "Nom ou mot-clé de l'événement pour le retrouver automatiquement (ex: 'kick-off', 'simulated professional work')"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getCurrentPageContext",
          description: "Renvoie l'URL et la page actuellement consultée par l'étudiant",
          parameters: { type: "object", properties: {} }
        }
      }
    ];

    let cachedLogin = null;
    async function getStudentLogin() {
      if (cachedLogin) return cachedLogin;
      try {
        const token = getEpitechToken();
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.login || payload.email || payload.upn || payload.sub) {
            cachedLogin = payload.login || payload.email || payload.upn || payload.sub;
            return cachedLogin;
          }
        }
      } catch {}
      try {
        const p = await fetchEpitech("/students/profile");
        if (p?.login) {
          cachedLogin = p.login;
          return cachedLogin;
        }
      } catch {}
      return null;
    }

    let cachedUnitMap = null;
    async function resolveUnitCode(input) {
      if (!input || typeof input !== 'string') return input;
      const clean = input.trim();
      // Si c'est déjà un code de module au format X-XXX-XXX (ex: G-PRO-500, S-INN-000, B-INN-000)
      if (/^[A-Z]-[A-Z0-9]{2,4}-[0-9]{3}$/i.test(clean)) {
        return clean.toUpperCase();
      }

      if (!cachedUnitMap) {
        cachedUnitMap = new Map();
        try {
          const pRes = await fetchEpitech("/units/instances/projects");
          const pList = pRes.data || (Array.isArray(pRes) ? pRes : []);
          for (const p of pList) {
            const u = p.unitInstance;
            if (u?.unitCode && u?.name) {
              cachedUnitMap.set(u.name.toLowerCase().trim(), u.unitCode);
              cachedUnitMap.set(u.unitCode.toLowerCase().trim(), u.unitCode);
            }
          }
        } catch {}

        try {
          const start = new Date();
          start.setDate(start.getDate() - 14);
          const end = new Date();
          end.setDate(end.getDate() + 30);
          const evs = await fetchEpitech(`/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}&registered=me`);
          if (Array.isArray(evs)) {
            for (const e of evs) {
              if (e.unitCode && e.unitName) {
                cachedUnitMap.set(e.unitName.toLowerCase().trim(), e.unitCode);
                cachedUnitMap.set(e.unitCode.toLowerCase().trim(), e.unitCode);
              }
            }
          }
        } catch {}
      }

      const q = clean.toLowerCase();
      if (cachedUnitMap.has(q)) return cachedUnitMap.get(q);

      for (const [name, code] of cachedUnitMap.entries()) {
        if (name.includes(q) || q.includes(name)) return code;
      }

      return clean;
    }

    const toolExecutors = {
      getMarks: async () => {
        const marks = await fetchEpitech("/students/evaluations/marks");
        if (!Array.isArray(marks)) return marks;
        return marks
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
          .slice(0, 30)
          .map(m => ({
            activite: m.activityTitle,
            note: m.mark,
            date: formatLocalDate(m.date),
            evaluateur: m.evaluator,
            commentaire: m.comment,
            evenement: m.eventTitle
          }));
      },
      getCredits: async () => {
        const c = await fetchEpitech("/evaluations/validations/credits/me");
        return {
          creditsAcquis: c.acquiredCredits,
          creditsAnterieurs: c.priorCredits,
          totalCreditsAcquis: c.totalAcquiredCredits
        };
      },
      getAcademicValidations: async () => {
        const v = await fetchEpitech("/evaluations/validations/me");
        return {
          semestreActuel: v.currentSemester,
          totalCredits: v.totalAcquiredCredits,
          blocsCompetences: (v.competencyBlocks || []).map(b => ({
            nom: b.title || b.name,
            creditsRequis: b.requiredCredits,
            creditsValides: b.validatedCredits,
            statut: b.status
          }))
        };
      },
      getGamification: async () => {
        const [xp, streak] = await Promise.all([
          fetchEpitech("/gamification/xp/me").catch(() => null),
          fetchEpitech("/gamification/streak/me").catch(() => null)
        ]);
        return {
          xp_balance: xp?.balance,
          niveau: xp?.level,
          streak_jours: streak?.streakCount
        };
      },
      getStudentProfile: async () => {
        const p = await fetchEpitech("/students/profile");
        return {
          login: p.login,
          prenom: p.firstname,
          nom: p.lastname,
          campus: p.campus?.name,
          promo: p.promotion?.value,
          semestre: p.semester?.code,
          gpa: p.gpa
        };
      },
      getLogtime: async () => {
        const data = await fetchEpitech("/students/logtime");
        if (!Array.isArray(data)) return data;
        return data.slice(-14).map(d => ({
          date: d.date,
          heures_etudiant: parseDurationToHours(d.log_time),
          moyenne_promo: parseDurationToHours(d.promo_log_time)
        }));
      },
      getProjects: async () => {
        const res = await fetchEpitech("/units/instances/projects");
        const list = res.data || (Array.isArray(res) ? res : []);
        return list.slice(0, 10).map(p => ({
          nom: p.name,
          debut: formatLocalDate(p.beginDate),
          fin: formatLocalDate(p.endDate),
          statut: p.status
        }));
      },
      getUpcomingEvents: async (args = {}) => {
        const days = Number(args?.daysAhead) || 7;
        const base = args?.targetDate ? new Date(args.targetDate) : new Date();
        const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0);
        const end = new Date(start.getTime() + (days * 24 * 60 * 60 * 1000) - 1000);

        const params = new URLSearchParams({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          registered: "me"
        });

        let events = [];
        try {
          events = await fetchEpitech(`/events?${params.toString()}`);
        } catch (e) {
          console.warn("[Marvin] Erreur lors de la récupération des événements:", e);
        }

        if (!Array.isArray(events)) return [];

        const myLogin = await getStudentLogin();

        return Promise.all(
          events
            .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0))
            .map(async e => {
              let creneauPerso = null;
              if (e.activitySlotsEnabled || e.slots) {
                try {
                  const slots = await fetchEpitech(`/events/${e.id}/slots`);
                  if (Array.isArray(slots)) {
                    const mySlot = slots.find(s =>
                      s.registration?.student?.login === myLogin ||
                      s.registration?.registeredStudents?.some(st => st.login === myLogin)
                    );
                    if (mySlot) {
                      creneauPerso = {
                        heure_debut: formatLocalTime(mySlot.startDate),
                        heure_fin: formatLocalTime(mySlot.endDate),
                        horaire: `${formatLocalTime(mySlot.startDate)} - ${formatLocalTime(mySlot.endDate)}`
                      };
                    }
                  }
                } catch (err) {
                  console.warn(`[Marvin] Impossible de charger les créneaux pour l'événement ${e.id}:`, err);
                }
              }

              const heureDebut = creneauPerso ? creneauPerso.heure_debut : formatLocalTime(e.startDate);
              const heureFin = creneauPerso ? creneauPerso.heure_fin : formatLocalTime(e.endDate);
              const horaireStr = creneauPerso
                ? `${creneauPerso.horaire} (votre créneau individuel de passage - session générale de ${formatLocalTime(e.startDate)} à ${formatLocalTime(e.endDate)})`
                : (e.activitySlotsEnabled
                  ? `${formatLocalTime(e.startDate)} - ${formatLocalTime(e.endDate)} (session à créneaux)`
                  : `${formatLocalTime(e.startDate)} - ${formatLocalTime(e.endDate)}`);

              return {
                id: e.id,
                titre: e.fullTitle || e.title || e.activityName,
                activite: e.activityName,
                module: e.unitName || e.unitCode,
                date: formatLocalDate(e.startDate),
                horaire: horaireStr,
                heure_debut: heureDebut,
                heure_fin: heureFin,
                creneauIndividuel: creneauPerso ? creneauPerso.horaire : null,
                salle: (Array.isArray(e.rooms) && e.rooms.length > 0) ? e.rooms.map(r => r.name).filter(Boolean).join(', ') : undefined,
                intervenants: (Array.isArray(e.instructors) && e.instructors.length > 0) ? e.instructors.map(i => `${i.firstname} ${i.lastname}`).join(', ') : undefined,
                estExamen: !!e.isExam,
                presenceOuverte: !!e.attendanceOpen
              };
            })
        );
      },
      getUnitRegistrations: async (args = {}) => {
        const rawCode = args?.unitCode || "G-ADM-500";
        const unitCode = await resolveUnitCode(rawCode);
        const year = args?.schoolYear || 2026;
        let instanceCode = args?.instanceCode;

        if (!instanceCode) {
          try {
            const p = await fetchEpitech("/students/profile");
            const campusCode = p?.campus?.code || "LIL";
            instanceCode = `${campusCode}-1`;
          } catch {
            instanceCode = "LIL-1";
          }
        }

        try {
          const regs = await fetchEpitech(`/units/${year}/${unitCode}/${instanceCode}/registrations`);
          if (!Array.isArray(regs)) {
            return { module: unitCode, nomRecherche: rawCode, instance: instanceCode, annee: year, error: `Impossible de récupérer les inscriptions pour le module ${unitCode}. Vérifiez le code ou le nom du module.` };
          }
          const myLogin = await getStudentLogin();
          const myReg = regs.find(r => r.student?.login === myLogin);
          return {
            module: unitCode,
            nomRecherche: rawCode !== unitCode ? rawCode : undefined,
            instance: instanceCode,
            annee: year,
            totalInscrits: regs.length,
            estInscrit: !!myReg,
            dateInscription: myReg?.createdAt ? formatLocalDate(myReg.createdAt) : null,
            inscritPar: myReg?.registeredBy || null,
            camaradesInscrits: regs
              .filter(r => r.student?.login !== myLogin)
              .slice(0, 50)
              .map(r => `${r.student?.firstname} ${r.student?.lastname}`)
          };
        } catch (err) {
          return { error: `Erreur lors de la requête du module ${unitCode} (${rawCode}): ${err.message}` };
        }
      },
      getEventSlots: async (args = {}) => {
        const eventId = Number(args?.eventId);
        if (!eventId) return { error: "ID d'événement requis" };
        try {
          const [eventInfo, slots] = await Promise.all([
            fetchEpitech(`/events/${eventId}`).catch(() => null),
            fetchEpitech(`/events/${eventId}/slots`)
          ]);
          if (!Array.isArray(slots)) return { error: "Aucun créneau trouvé pour cet événement." };
          const myLogin = await getStudentLogin();
          return {
            evenement: eventInfo?.fullTitle || eventInfo?.activity?.name || `Événement ${eventId}`,
            totalCreneaux: slots.length,
            creneaux: slots.map(s => {
              const reg = s.registration;
              const isMine = reg?.student?.login === myLogin || reg?.registeredStudents?.some(st => st.login === myLogin);
              return {
                id: s.id,
                horaire: `${formatLocalTime(s.startDate)} - ${formatLocalTime(s.endDate)}`,
                heure_debut: formatLocalTime(s.startDate),
                heure_fin: formatLocalTime(s.endDate),
                estReserve: !!reg,
                estMonCreneau: isMine,
                etudiant: isMine ? "Vous-même" : (reg?.student ? `${reg.student.firstname} ${reg.student.lastname}` : null)
              };
            })
          };
        } catch (err) {
          return { error: `Erreur lors de la récupération des créneaux: ${err.message}` };
        }
      },
      getEventRegistrations: async (args = {}) => {
        let eventId = Number(args?.eventId);

        if (!eventId && args?.search) {
          try {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
            const params = new URLSearchParams({
              startDate: start.toISOString(),
              endDate: end.toISOString(),
              registered: "me"
            });
            const evs = await fetchEpitech(`/events?${params.toString()}`);
            if (Array.isArray(evs)) {
              const q = args.search.toLowerCase();
              const found = evs.find(e =>
                (e.fullTitle && e.fullTitle.toLowerCase().includes(q)) ||
                (e.title && e.title.toLowerCase().includes(q)) ||
                (e.activityName && e.activityName.toLowerCase().includes(q))
              );
              if (found) eventId = found.id;
            }
          } catch (e) {
            console.warn("[Marvin] Erreur recherche event par mot-clé:", e);
          }
        }

        if (!eventId) return { error: "ID d'événement introuvable. Précisez l'ID ou le nom exact de l'événement." };

        try {
          const [eventInfo, regs] = await Promise.all([
            fetchEpitech(`/events/${eventId}`).catch(() => null),
            fetchEpitech(`/events/${eventId}/registrations`)
          ]);

          if (!Array.isArray(regs)) {
            return { error: "Impossible de récupérer les inscriptions pour cet événement." };
          }

          const myLogin = await getStudentLogin();
          const students = regs
            .map(r => r.student)
            .filter(Boolean)
            .sort((a, b) => (a.lastname || "").localeCompare(b.lastname || ""));

          return {
            evenement: eventInfo?.fullTitle || eventInfo?.title || eventInfo?.activityName || `Événement ${eventId}`,
            totalInscrits: students.length,
            camaradesInscrits: students
              .filter(s => s.login !== myLogin)
              .map(s => `${s.firstname} ${s.lastname}`),
            vousEtesInscrit: students.some(s => s.login === myLogin)
          };
        } catch (err) {
          return { error: `Erreur lors de la récupération des inscriptions: ${err.message}` };
        }
      },
      getNotifications: async () => {
        const feed = await fetchEpitech("/notifications/feed");
        return Array.isArray(feed) ? feed.slice(0, 8) : feed;
      },
      getCurrentPageContext: async () => ({
        url: window.location.href,
        pathname: window.location.pathname
      })
    };

    function callOllamaBridge(payload) {
      if (typeof window.__marvinOllamaBridge === 'function') {
        return window.__marvinOllamaBridge(payload);
      }
      return new Promise((resolve, reject) => {
        const callId = 'ollama_' + Math.random().toString(36).substr(2, 9);
        function handler(ev) {
          if (ev.data && ev.data.type === 'MARVIN_OLLAMA_CALL_RES' && ev.data.id === callId) {
            window.removeEventListener('message', handler);
            if (ev.data.error) reject(new Error(ev.data.error));
            else resolve(ev.data.data);
          }
        }
        window.addEventListener('message', handler);
        window.postMessage({ type: 'MARVIN_OLLAMA_CALL_REQ', id: callId, payload: payload }, '*');
      });
    }

    // =========================================================================
    // 1. HOOK SELECTIF Array.prototype.includes('student')
    // =========================================================================
    // Permet à React de monter <qi /> (FloatingWindow) et <Ss /> (headerCenterContent)
    // tout en maintenant l'interface étudiante à 100% (dashboard, sidebar, notes).
    const origIncludes = Array.prototype.includes;
    Array.prototype.includes = function (search) {
      if (search === 'student') {
        const stack = (new Error().stack || '');
        // Si l'appel vient de Ss (barre de recherche + bouton Marvin) ou Es (panneau flottant Marvin)
        if (/\b(Ss|Es)(?:\s*\(|@)/.test(stack) || (/\bCs\b/.test(stack) && window.innerWidth < 992)) {
          return false; // Répond "non" au guard pour que React affiche le bouton et le panneau !
        }
      }
      return origIncludes.apply(this, arguments);
    };

    // =========================================================================
    // 2. INTERCEPTION XMLHttpRequest (pour Axios / React Query)
    // =========================================================================
    // Intercepte les requêtes de disponibilité, conversations et quota de Marvin
    const OriginalXHR = window.XMLHttpRequest;

    class PatchedXHR extends OriginalXHR {
      constructor() {
        super();
        this._marvinUrl = null;
        this._marvinMethod = null;
        this._marvinHeaders = {};
      }

      open(method, url, ...rest) {
        this._marvinMethod = (method || 'GET').toUpperCase();
        this._marvinUrl = url;
        return super.open(method, url, ...rest);
      }

      setRequestHeader(name, value) {
        this._marvinHeaders[name.toLowerCase()] = value;
        return super.setRequestHeader(name, value);
      }

      send(body) {
        const url = this._marvinUrl || '';
        const method = this._marvinMethod || 'GET';

        // Si la requête concerne Marvin ou les quotas IA
        if (url.includes('/ai/chatbot/') || url.includes('/ai/quota/')) {
          this._handleMarvinXHR(method, url, body);
          return;
        }

        return super.send(body);
      }

      _handleMarvinXHR(method, url, body) {
        setTimeout(() => {
          let responseData = null;
          let status = 200;

          // A) Disponibilité de Marvin
          if (url.includes('/ai/chatbot/availability')) {
            responseData = {
              enabled: true,
              unlimited: true,
              windows: []
            };
          }
          // B) Quota IA
          else if (url.includes('/ai/quota/me')) {
            responseData = {
              unlimited: true,
              windows: []
            };
          }
          // C) Liste des conversations ou création
          else if (url.includes('/ai/chatbot/conversations')) {
            const convs = getLocalConversations();
            const idMatch = url.match(/\/ai\/chatbot\/conversations\/([^\/\?]+)/);

            if (idMatch) {
              const convId = idMatch[1];
              if (method === 'DELETE') {
                const filtered = convs.filter(c => c.id !== convId);
                saveLocalConversations(filtered);
                responseData = {};
              } else {
                // GET /ai/chatbot/conversations/:id
                const conv = convs.find(c => c.id === convId);
                responseData = {
                  id: convId,
                  title: conv ? conv.title : "Discussion",
                  messages: (conv ? conv.messages : []).map(m => ({
                    role: m.role,
                    content: m.content,
                    toolCalls: m.toolCalls || []
                  }))
                };
              }
            } else {
              if (method === 'POST') {
                // POST /ai/chatbot/conversations (Nouvelle discussion)
                const newId = "conv_" + Date.now();
                const newConv = {
                  id: newId,
                  title: "Nouvelle discussion",
                  preview: "",
                  updatedAt: new Date().toISOString(),
                  messages: []
                };
                convs.unshift(newConv);
                saveLocalConversations(convs);
                responseData = newConv;
              } else {
                // GET /ai/chatbot/conversations
                responseData = {
                  data: convs.map(c => ({
                    id: c.id,
                    title: c.title,
                    preview: c.preview,
                    updatedAt: c.updatedAt,
                    messageCount: c.messages?.length || 0
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
          if (this.responseType === 'json') {
            finalResponse = responseData;
          }

          Object.defineProperties(this, {
            readyState: { value: 4, writable: true, configurable: true },
            status: { value: status, writable: true, configurable: true },
            statusText: { value: 'OK', writable: true, configurable: true },
            responseText: { value: responseText, writable: true, configurable: true },
            response: { value: finalResponse, writable: true, configurable: true }
          });

          this.getAllResponseHeaders = () => "content-type: application/json\r\n";
          this.getResponseHeader = (h) => h.toLowerCase() === 'content-type' ? 'application/json' : null;

          if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
          this.dispatchEvent(new Event('readystatechange'));

          if (typeof this.onload === 'function') this.onload();
          this.dispatchEvent(new Event('load'));

          if (typeof this.onloadend === 'function') this.onloadend();
          this.dispatchEvent(new Event('loadend'));
        }, 5);
      }
    }

    window.XMLHttpRequest = PatchedXHR;

    // =========================================================================
    // 3. INTERCEPTION window.fetch (pour le streaming SSE d'Ollama Cloud)
    // =========================================================================
    const origFetch = window.fetch;

    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : (input?.url || '');

      // Streaming d'un message vers Ollama Cloud
      if (url.includes('/ai/chatbot/conversations/') && url.endsWith('/messages')) {
        const idMatch = url.match(/\/conversations\/([^\/]+)\/messages/);
        const convId = idMatch ? idMatch[1] : "conv_default";

        let bodyData = {};
        try {
          bodyData = typeof init?.body === 'string' ? JSON.parse(init.body) : (init?.body || {});
        } catch {}

        const userContent = bodyData.content || "";
        const pageContext = bodyData.pageContext || window.location.pathname;

        // Préparation du stream SSE vers l'interface Mantine
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();

            function sendEvent(type, dataObj) {
              const text = `event: ${type}\ndata: ${JSON.stringify(dataObj)}\n\n`;
              controller.enqueue(encoder.encode(text));
            }

            try {
              let convs = getLocalConversations();
              let conv = convs.find(c => c.id === convId);
              if (!conv) {
                conv = {
                  id: convId,
                  title: userContent.slice(0, 30),
                  preview: userContent.slice(0, 60),
                  updatedAt: new Date().toISOString(),
                  messages: []
                };
                convs.unshift(conv);
              }

              conv.messages.push({ role: "user", content: userContent });

              const nowDate = new Date();
              const todayISO = nowDate.toISOString().slice(0, 10);
              const tomorrowDate = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);
              const tomorrowISO = tomorrowDate.toISOString().slice(0, 10);
              const todayFr = nowDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              const tomorrowFr = tomorrowDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

              let ollamaMessages = [
                {
                  role: "system",
                  content: `Tu es Marvin, l'assistant officiel de MyEpitech connecté à Ollama Cloud (${MODEL_NAME}). Réponds en français de manière claire, structurée et concise.
Date actuelle : ${todayFr} (${todayISO}). Demain : ${tomorrowFr} (${tomorrowISO}). Fuseau horaire : ${getBrowserTimeZone()} (UTC+2 en été).
Tu as accès à des outils pour consulter en direct les données officielles de l'étudiant :
- getUpcomingEvents : consulte le planning et l'emploi du temps officiel (cours, créneaux, kick-offs, soutenances, examens). Les horaires ('horaire', 'heure_debut', 'heure_fin') sont DÉJÀ convertis dans le fuseau horaire local du navigateur (${getBrowserTimeZone()}) et incluent automatiquement l'heure de passage individuelle réservée pour les activités à créneaux (slots). Utilise toujours ces horaires locaux formatés dans tes réponses. Mentionne systématiquement la salle ('salle') et l'intervenant ('intervenants'). Si la liste est vide, indique clairement qu'aucun événement n'est inscrit.
- getEventRegistrations : liste tous les camarades de promo inscrits à un événement du planning (kick-off, cours, soutenance). Utilise SYSTÉMATIQUEMENT cet outil dès que l'étudiant demande 'qui est inscrit avec moi' ou qui participe à une session ! Tu as l'autorisation officielle d'afficher la liste des camarades inscrits, ne prétends jamais qu'il y a des restrictions de confidentialité.
- getUnitRegistrations : vérifie les inscriptions officielles à un module/unité (ex: G-ADM-500, G-PRO-500) pour confirmer si l'étudiant y est inscrit, la date d'inscription et la liste des inscrits.
- getEventSlots : consulte la liste complète des créneaux (slots) d'un événement du planning pour voir les créneaux disponibles et le créneau réservé par l'étudiant.
- getMarks : récupère les notes chiffrées de l'étudiant (notes d'examens, soutenances, projets, évaluations, avec note/20, commentaire et évaluateur). Utilise systématiquement cet outil quand l'étudiant te demande ses notes !
- getCredits : récupère le total des crédits ECTS acquis et totaux
- getAcademicValidations : tableau de bord des validations par bloc de compétences
- getStudentProfile : profil (nom, campus, promo, semestre, GPA)
- getLogtime : heures de logtime des 14 derniers jours avec comparaison promo
- getProjects : projets en cours et récents avec dates et statuts
- getNotifications : notifications récentes
- getGamification : solde XP, niveau et streak
Contexte de navigation actuel : ${pageContext}.`
                },
                ...conv.messages.map(m => ({
                  role: m.role,
                  content: m.content || ""
                }))
              ];

              async function executeOllamaCycle() {
                const resp = await callOllamaBridge({
                  model: MODEL_NAME,
                  messages: ollamaMessages,
                  tools: tools,
                  stream: false
                });

                const assistantMsg = resp.message;
                if (!assistantMsg) throw new Error("Réponse vide reçue d'Ollama Cloud");

                // Gestion des tool calls de Gemma
                if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
                  ollamaMessages.push(assistantMsg);

                  for (const call of assistantMsg.tool_calls) {
                    const callId = call.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    const fnName = call.function.name;
                    const fnArgs = call.function.arguments || {};

                    // Badge Mantine "outil en cours"
                    sendEvent("tool_call", {
                      id: callId,
                      name: fnName,
                      arguments: fnArgs
                    });

                    let result;
                    let ok = true;
                    try {
                      if (toolExecutors[fnName]) {
                        result = await toolExecutors[fnName](fnArgs);
                      } else {
                        result = { error: `Outil non supporté : ${fnName}` };
                        ok = false;
                      }
                    } catch (e) {
                      result = { error: e.message };
                      ok = false;
                    }

                    // Badge Mantine "outil exécuté"
                    sendEvent("tool_result", {
                      toolCallId: callId,
                      ok: ok,
                      result: result
                    });

                    ollamaMessages.push({
                      role: "tool",
                      content: JSON.stringify(result)
                    });
                  }

                  return executeOllamaCycle();
                }

                // Texte de réponse
                if (assistantMsg.content) {
                  sendEvent("delta", { delta: assistantMsg.content });

                  conv.messages.push({
                    role: "assistant",
                    content: assistantMsg.content
                  });
                  conv.preview = assistantMsg.content.slice(0, 80);
                  conv.updatedAt = new Date().toISOString();
                  saveLocalConversations(convs);
                }

                sendEvent("done", {});
                controller.close();
              }

              await executeOllamaCycle();
            } catch (err) {
              sendEvent("error", { message: err.message });
              controller.close();
            }
          }
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache"
          }
        });
      }

      // Approbations d'outils
      if (url.includes('/ai/chatbot/conversations/') && url.endsWith('/approvals')) {
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          }
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" }
        });
      }

      return origFetch.apply(this, arguments);
    };

    // =========================================================================
    // 4. OBSERVATEUR & FILET DE SÉCURITÉ POUR LE BOUTON NAVBAR
    // =========================================================================
    // Si pour une quelconque raison responsive Mantine cache <Ss />, ce filet
    // injecte immédiatement le bouton officiel dans le header.
    function getChatbotController() {
      const el = document.querySelector('header') || document.getElementById('root');
      if (!el) return null;
      const key = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
      if (!key) return null;
      let fiber = el[key];
      while (fiber) {
        const val = fiber.memoizedProps?.value;
        if (val && typeof val.toggle === 'function' && typeof val.open === 'function') {
          return val;
        }
        fiber = fiber.return;
      }
      return null;
    }

    const buttonWatcher = setInterval(() => {
      const existing = document.querySelector('[data-testid="chatbot-open"]');
      if (existing) {
        // Le bouton officiel Mantine <So /> est bien présent et visible !
        return;
      }

      const header = document.querySelector('header');
      if (!header) return;

      // Recherche du conteneur des actions à droite du header
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
          console.warn("[Marvin] Chatbot controller non encore prêt");
        }
      };

      actionsContainer.prepend(btn);
    }, 500);
  }

  // Applique les hooks à unsafeWindow et injecte dans le DOM dès que possible
  function applyScriptTag() {
    try {
      const target = win.document && (win.document.head || win.document.documentElement);
      if (target) {
        const code = `(${mainPageHook.toString()})();`;
        const s = win.document.createElement('script');
        s.textContent = code;
        target.appendChild(s);
        s.remove();
        return true;
      }
    } catch (e) {}
    return false;
  }

  // 1. Exécution immédiate dans unsafeWindow
  if (win && win !== window) {
    try {
      win.eval(`(${mainPageHook.toString()})();`);
    } catch (e) {
      try { mainPageHook(); } catch (err) {}
    }
  } else {
    mainPageHook();
  }

  // 2. Injection balise <script> dans le DOM de la page dès que disponible
  if (!applyScriptTag() && win.document) {
    const obs = new MutationObserver(() => {
      if (applyScriptTag()) obs.disconnect();
    });
    obs.observe(win.document, { childList: true, subtree: true });
  }

})();
