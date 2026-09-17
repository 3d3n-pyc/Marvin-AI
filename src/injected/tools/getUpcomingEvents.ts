/**
 * @fileoverview Outil de consultation du planning officiel Epitech.
 * Récupère les cours, kick-offs, soutenances, examens et créneaux individuels de passage.
 * @module injected/tools/getUpcomingEvents
 * @see {@link https://my.epitech.eu/planning}
 * @endpoint GET /events
 */

import { fetchEpitech } from '../utils/api';
import { formatLocalDate, formatLocalTime } from '../utils/format';

/**
 * Paramètres de recherche pour le planning d'événements.
 */
export interface UpcomingEventsArgs {
  /** Nombre de jours à couvrir à partir de la date de référence (défaut : 7). */
  daysAhead?: number;
  /** Date de départ au format ISO (ex: "2026-09-17"). Par défaut : aujourd'hui. */
  targetDate?: string;
  /** Filtre textuel optionnel sur le titre de l'activité, du cours ou du module. */
  query?: string;
  /** Restreindre la recherche uniquement aux examens et évaluations notées. */
  onlyExams?: boolean;
}

/**
 * Représentation synthétique d'un événement du planning.
 */
export interface FormattedEvent {
  /** Identifiant unique de l'événement. */
  id: number | string;
  /** Titre complet de l'événement. */
  titre: string;
  /** Nom de l'activité pédagogique associée. */
  activite: string;
  /** Nom et code du module d'enseignement associé. */
  module: string;
  /** Date au format local lisible. */
  date: string;
  /** Plage horaire textuelle (incluant le créneau individuel si réservé). */
  horaire: string;
  /** Heure locale de début (créneau individuel si existant, sinon séance globale). */
  heure_debut: string;
  /** Heure locale de fin (créneau individuel si existant, sinon séance globale). */
  heure_fin: string;
  /** Créneau réservé si disponible sous forme "HH:mm - HH:mm", ou null. */
  creneauReserve: string | null;
  /** Salle(s) assignée(s) ou 'Non assignée'. */
  salle: string;
  /** Noms des intervenants ou professeurs encadrants. */
  intervenants?: string;
  /** Indique si l'activité est un examen officiel. */
  estExamen: boolean;
  /** Indique si la validation de présence est actuellement ouverte. */
  presenceOuverte: boolean;
}

/**
 * Récupère et filtre les événements du planning officiel de l'étudiant.
 *
 * @param args - Filtres de dates, mot-clé ou type d'événement.
 * @returns Liste ordonnée chronologiquement des événements ou objet d'erreur.
 */
export async function getUpcomingEvents(
  args: UpcomingEventsArgs = {}
): Promise<FormattedEvent[] | { error: string }> {
  const days = Number(args?.daysAhead) || 7;
  const base = args?.targetDate ? new Date(args.targetDate) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0);
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000 - 1000);

  const params = new URLSearchParams({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    registered: 'me'
  });

  try {
    const events = await fetchEpitech<any[]>(`/events?${params.toString()}`);
    if (!Array.isArray(events)) return [];

    let filtered = events;

    // Filtre par mot-clé si demandé
    if (args.query) {
      const q = args.query.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          (e.fullTitle && e.fullTitle.toLowerCase().includes(q)) ||
          (e.activityName && e.activityName.toLowerCase().includes(q)) ||
          (e.unitName && e.unitName.toLowerCase().includes(q)) ||
          (e.unitCode && e.unitCode.toLowerCase().includes(q))
      );
    }

    // Filtre examens
    if (args.onlyExams) {
      filtered = filtered.filter((e) => e.isExam);
    }

    filtered.sort(
      (a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime()
    );

    return filtered.map((e) => {
      // Créneau individuel si disponible dans l'objet ou mySlot
      const hasPersonalSlot = !!(e.mySlotStartDate && e.mySlotEndDate);
      const heureDebut = hasPersonalSlot ? formatLocalTime(e.mySlotStartDate) : formatLocalTime(e.startDate);
      const heureFin = hasPersonalSlot ? formatLocalTime(e.mySlotEndDate) : formatLocalTime(e.endDate);

      let horaireDesc = `${formatLocalTime(e.startDate)} - ${formatLocalTime(e.endDate)}`;
      if (hasPersonalSlot) {
        horaireDesc = `${heureDebut} - ${heureFin} (votre créneau individuel de passage - session générale ${formatLocalTime(e.startDate)} à ${formatLocalTime(e.endDate)})`;
      } else if (e.activitySlotsEnabled) {
        horaireDesc = `${formatLocalTime(e.startDate)} - ${formatLocalTime(e.endDate)} (activité à créneaux - aucun créneau réservé)`;
      }

      return {
        id: e.id,
        titre: e.fullTitle || e.title || e.activityName,
        activite: e.activityName,
        module: e.unitName ? `${e.unitName} (${e.unitCode})` : e.unitCode,
        date: formatLocalDate(e.startDate),
        horaire: horaireDesc,
        heure_debut: heureDebut,
        heure_fin: heureFin,
        creneauReserve: hasPersonalSlot ? `${heureDebut} - ${heureFin}` : null,
        salle: Array.isArray(e.rooms) && e.rooms.length > 0
          ? e.rooms.map((r: any) => r.name).filter(Boolean).join(', ')
          : 'Non assignée',
        intervenants: Array.isArray(e.instructors) && e.instructors.length > 0
          ? e.instructors.map((i: any) => `${i.firstname} ${i.lastname}`).join(', ')
          : undefined,
        estExamen: !!e.isExam,
        presenceOuverte: !!(e.attendanceOpen || e.attendanceActive)
      };
    });
  } catch (err: any) {
    return { error: `Erreur lors de la récupération des événements du planning : ${err.message}` };
  }
}
