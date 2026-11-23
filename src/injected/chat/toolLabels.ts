/**
 * Human-readable French labels for the tools shown in the chat panel.
 */

const LABELS: Record<string, string> = {
  getStudentProfile: 'Lecture du profil',
  getUpcomingEvents: 'Lecture des événements à venir',
  getProjects: 'Lecture des projets',
  getEvaluations: 'Lecture des évaluations',
  getLogtime: 'Lecture du logtime',
  getArgosTests: 'Lecture des tests Argos',
  getAbsences: 'Lecture des absences',
  getAcademicValidations: 'Lecture des validations',
  getGamification: 'Lecture de la gamification',
  getNotifications: 'Lecture des notifications',
  confirmAttendance: 'Confirmation de présence',
  getProjectInvitations: 'Lecture des invitations de projet',
  respondProjectInvitation: 'Réponse à une invitation de projet',
  getCollaborators: 'Lecture des collaborateurs',
  getEventRegistrations: 'Lecture des inscriptions aux événements',
  getEventSlots: 'Lecture des créneaux',
  getUnitRegistrations: 'Lecture des inscriptions aux unités',
  getCurrentPageContext: 'Lecture de la page courante',
};

/** Return the French label of a tool, or the tool name itself when unknown. */
export function toolLabel(name: string): string {
  return Object.prototype.hasOwnProperty.call(LABELS, name) ? LABELS[name] : name;
}
