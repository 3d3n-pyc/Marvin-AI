/**
 * @fileoverview Fonctions utilitaires de formatage des dates, heures et durées ISO 8601.
 * Assure la conversion dans le fuseau horaire du navigateur de l'étudiant.
 * @module injected/utils/format
 */

/**
 * Convertit une durée au format ISO 8601 (ex: "PT2H30M" ou "PT418.817S") en heures décimales.
 *
 * @param str - Chaîne de durée ISO 8601.
 * @returns Nombre d'heures arrondi au dixième (ex: 2.5).
 * @example
 * ```ts
 * parseDurationToHours("PT1H30M"); // 1.5
 * parseDurationToHours("PT3600S"); // 1.0
 * ```
 */
export function parseDurationToHours(str?: string): number {
  if (!str) return 0;
  const m = str.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return 0;
  const s =
    parseFloat(m[1] || '0') * 3600 +
    parseFloat(m[2] || '0') * 60 +
    parseFloat(m[3] || '0');
  return Math.round((s / 3600) * 10) / 10;
}

/**
 * Détecte le fuseau horaire IANA configuré sur le navigateur client.
 *
 * @returns Identifiant du fuseau horaire (ex: "Europe/Paris").
 */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

/**
 * Formate un horodatage ISO en heure locale lisible (HH:mm).
 *
 * @param isoStr - Horodatage ISO (ex: "2026-09-17T14:30:00.000Z").
 * @returns Chaîne formatée en heure locale (ex: "16:30").
 */
export function formatLocalTime(isoStr?: string): string {
  if (!isoStr) return '';
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

/**
 * Formate un horodatage ISO en date complète en français (ex: "jeudi 17 septembre 2026").
 *
 * @param isoStr - Horodatage ISO (ex: "2026-09-17T14:30:00.000Z").
 * @returns Date complète formatée selon les conventions françaises.
 */
export function formatLocalDate(isoStr?: string): string {
  if (!isoStr) return '';
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
