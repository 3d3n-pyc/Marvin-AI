/**
 * @fileoverview Registre central des exécuteurs d'outils (Tool Executors) de Marvin AI.
 * Associe les identifiants d'outils invoqués par Ollama aux implémentations TypeScript concrètes.
 * @module injected/tools
 */

import { getStudentProfile } from './getStudentProfile';
import { getUpcomingEvents } from './getUpcomingEvents';
import { getProjects } from './getProjects';
import { getEvaluations } from './getEvaluations';
import { getLogtime } from './getLogtime';
import { getArgosTests } from './getArgosTests';
import { getAbsences } from './getAbsences';
import { getAcademicValidations } from './getAcademicValidations';
import { getGamification } from './getGamification';
import { getNotifications } from './getNotifications';
import { confirmAttendance } from './confirmAttendance';
import { getProjectInvitations } from './getProjectInvitations';
import { respondProjectInvitation } from './respondProjectInvitation';
import { getCollaborators } from './getCollaborators';
import { getEventRegistrations } from './getEventRegistrations';
import { getEventSlots } from './getEventSlots';
import { getUnitRegistrations } from './getUnitRegistrations';
import { getCurrentPageContext } from './getCurrentPageContext';

/**
 * Table de correspondance liant chaque identifiant d'outil à sa fonction d'exécution asynchrone.
 */
export const toolExecutors: Record<string, (args?: any) => Promise<any>> = {
  getStudentProfile,
  getUpcomingEvents,
  getProjects,
  getEvaluations,
  getLogtime,
  getArgosTests,
  getAbsences,
  getAcademicValidations,
  getGamification,
  getNotifications,
  confirmAttendance,
  getProjectInvitations,
  respondProjectInvitation,
  getCollaborators,
  getEventRegistrations,
  getEventSlots,
  getUnitRegistrations,
  getCurrentPageContext
};

export {
  getStudentProfile,
  getUpcomingEvents,
  getProjects,
  getEvaluations,
  getLogtime,
  getArgosTests,
  getAbsences,
  getAcademicValidations,
  getGamification,
  getNotifications,
  confirmAttendance,
  getProjectInvitations,
  respondProjectInvitation,
  getCollaborators,
  getEventRegistrations,
  getEventSlots,
  getUnitRegistrations,
  getCurrentPageContext
};
