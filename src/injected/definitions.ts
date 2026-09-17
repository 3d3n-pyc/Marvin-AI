/**
 * @fileoverview Déclarations des outils d'assistance (Tool Calling) pour Marvin AI.
 * Fournit les schémas de fonctions compatibles OpenAPI transmis à l'API Ollama.
 * @module injected/definitions
 */

import type { ToolDefinition } from '../types';

/**
 * Registre exhaustif des 18 outils utilisables par l'assistant Marvin.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'getStudentProfile',
      description: "Récupère le profil officiel de l'étudiant connecté (nom, prénom, login, campus, promo, cursus, semestre, GPA, statut redoublant).",
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getUpcomingEvents',
      description: "Consulte le planning et l'emploi du temps officiel de l'étudiant (cours, kick-offs, soutenances, examens, créneaux de passage). Les horaires et créneaux individuels sont déjà convertis dans le fuseau horaire local.",
      parameters: {
        type: 'object',
        properties: {
          daysAhead: {
            type: 'number',
            description: "Nombre de jours à récupérer à partir d'aujourd'hui (1 pour aujourd'hui, 2 pour demain inclus, 7 pour la semaine. Par défaut: 7)."
          },
          targetDate: {
            type: 'string',
            description: "Date précise de départ au format YYYY-MM-DD si l'étudiant demande un jour précis (ex: demain ou date fixe)."
          },
          query: {
            type: 'string',
            description: "Mot-clé ou nom d'activité pour filtrer (ex: 'kick-off', 'soutenance', 'anglais')."
          },
          onlyExams: {
            type: 'boolean',
            description: "Mettre à true pour ne renvoyer que les examens ou soutenances notées."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getProjects',
      description: "Récupère la liste des projets et devoirs (deadlines de rendu, jours restants, composition d'équipe, coéquipiers et lien Hermes). ATTENTION : Ne concerne que les PROJETS (ex: Dashboard, Survivor, Bloodhound). Pour connaître les MODULES/cours inscrits, utiliser getUnitRegistrations.",
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ongoing', 'all'],
            description: "'ongoing' pour les projets actuellement en cours, 'all' pour inclure les projets passés."
          },
          registeredOnly: {
            type: 'boolean',
            description: "Ne récupérer que les projets auxquels l'étudiant est officiellement inscrit (par défaut: true)."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getEvaluations',
      description: "Récupère les notes, soutenances, retours des jurys/professeurs, commentaires détaillés et barèmes des évaluations de l'étudiant.",
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: "Nombre maximum d'évaluations à retourner (par défaut: 20)."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getLogtime',
      description: "Récupère les heures de logtime des 14 derniers jours avec synthèse hebdomadaire (total étudiant, total promo, avance/retard, moyenne par jour).",
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getArgosTests',
      description: "Récupère les résultats de la moulinette Argos sur les projets (tests automatiques passés/échoués, crashs, fautes de norme/coding style fatal/major/minor/info).",
      parameters: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'Année académique (ex: 2026, 2025). Par défaut: année courante avec fallback automatique.'
          },
          projectQuery: {
            type: 'string',
            description: "Nom ou slug du projet recherché (ex: 'hackjuice', 'arcade', 'raytracer')."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAbsences',
      description: "Récupère le bilan des absences par projet (taux d'absence %, seuil d'exclusion dépassé ou non) et la liste des séances manquées non justifiées.",
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAcademicValidations',
      description: "Consulte les crédits ECTS acquis, le seuil de passage à l'année supérieure, les crédits manquants, les blocs de compétences et les examens certifiants (TEPitech).",
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getGamification',
      description: "Récupère le profil de gamification : niveau XP, points XP totaux et restants, série de jours consécutifs (streak) et vies restantes.",
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getNotifications',
      description: "Récupère les notifications récentes reçues par l'étudiant (notes publiées, changement de salle/horaire, nouveaux membres de groupe, invitations).",
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: "Nombre de notifications à renvoyer (par défaut: 20)."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'confirmAttendance',
      description: "Valide la présence de l'étudiant à une séance en cours à l'aide d'un code de présence fourni par l'intervenant (ex: '4821').",
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code numérique de présence fourni par le professeur (ex: "4821").'
          },
          eventId: {
            type: 'number',
            description: "ID de l'événement (optionnel : s'il est omis, l'événement actif aujourd'hui sera détecté automatiquement)."
          }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getProjectInvitations',
      description: "Consulte les invitations reçues en attente pour rejoindre une équipe / un groupe de projet.",
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'respondProjectInvitation',
      description: "Accepte ou refuse une invitation à rejoindre un groupe de projet.",
      parameters: {
        type: 'object',
        properties: {
          memberId: {
            type: 'number',
            description: "Identifiant numérique de l'invitation (memberId obtenu via getProjectInvitations)."
          },
          action: {
            type: 'string',
            enum: ['accept', 'decline'],
            description: "'accept' pour accepter et rejoindre le groupe, 'decline' pour refuser."
          }
        },
        required: ['memberId', 'action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCollaborators',
      description: "Consulte la liste des camarades de promo avec lesquels l'étudiant collabore le plus fréquemment et leurs projets partagés.",
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getEventRegistrations',
      description: "Consulte la liste complète des étudiants inscrits à un cours, kick-off ou soutenance du planning (pour savoir qui est inscrit avec soi).",
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'number',
            description: "ID numérique de l'événement (ex: 22280)."
          },
          search: {
            type: 'string',
            description: "Nom ou mot-clé de l'événement pour le retrouver automatiquement (ex: 'kick-off', 'suivi')."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getEventSlots',
      description: "Consulte la liste complète des créneaux (slots) de rendez-vous, l'ordre de passage et les étudiants inscrits (qui passe avant/après moi, créneau réservé). À appeler SYSTÉMATIQUEMENT dès qu'on te demande qui passe à quelle heure, qui passe avant ou après l'étudiant. Si eventId est omis, l'événement actif à l'écran ou du jour est détecté automatiquement.",
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'number',
            description: "ID numérique de l'événement (optionnel : détecté automatiquement depuis l'URL de la page ou le planning du jour si omis)."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getUnitRegistrations',
      description: "Récupère la liste officielle des modules et unités d'enseignement (ex: Innovation Hub, Anglais, Web, Cloud Platform) auxquels l'étudiant est inscrit, ou vérifie l'inscription à un module spécifique. À APPELER SYSTÉMATIQUEMENT dès que l'étudiant demande à quels modules ou cours il est inscrit.",
      parameters: {
        type: 'object',
        properties: {
          unitCode: {
            type: 'string',
            description: "Code ou nom du module à vérifier (ex: 'B-INN-000', 'Innovation Hub', 'G-ENG-500', 'anglais'). Si omis, renvoie TOUS les modules inscrits de l'année scolaire."
          },
          schoolYear: {
            type: 'number',
            description: "Année scolaire (optionnel, par défaut année courante 2026)."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCurrentPageContext',
      description: "Renvoie l'URL et le titre de la page actuellement affichée à l'écran de l'étudiant.",
      parameters: { type: 'object', properties: {} }
    }
  }
];
