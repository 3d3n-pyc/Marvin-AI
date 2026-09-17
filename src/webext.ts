/**
 * @fileoverview Couche d'abstraction WebExtension universelle (Chrome & Firefox).
 * Initialise l'alias global `browser` sur `chrome` lorsque l'environnement Chromium est détecté.
 * @module webext
 */

// Si l'environnement d'exécution est Chromium (Chrome, Edge, Brave), mapper browser sur chrome
if (typeof (globalThis as any).browser === 'undefined' && typeof (globalThis as any).chrome !== 'undefined') {
  (globalThis as any).browser = (globalThis as any).chrome;
}

/** Instance unifiée de l'API WebExtension compatible Chrome (MV3) et Firefox. */
export const webext = (
  typeof browser !== 'undefined'
    ? browser
    : (globalThis as any).chrome
) as typeof browser;
