/**
 * @fileoverview Contrôleur de l'interface utilisateur de configuration (Popup de la barre d'outils).
 * Permet à l'étudiant de définir sa clé d'API blade.sh et son modèle préféré,
 * et de valider la connectivité en temps réel.
 * @module popup
 */

import '../webext';
import { DEFAULT_CONFIG, getStoredConfig, saveStoredConfig } from '../config';

const BLADE_ORIGINS = ['https://api.models.blade.sh/*'];

/**
 * Indique si l'accès à blade.sh est autorisé (true si l'API permissions est absente).
 *
 * @returns Vrai si la permission d'hôte est accordée.
 */
async function hasBladeAccess(): Promise<boolean> {
  if (typeof browser === 'undefined' || !browser.permissions) return true;
  return browser.permissions.contains({ origins: BLADE_ORIGINS });
}

/**
 * Demande l'accès à blade.sh. À appeler directement depuis un geste utilisateur.
 *
 * @returns Vrai si l'accès est accordé (ou si l'API permissions est absente).
 */
function requestBladeAccess(): Promise<boolean> {
  if (typeof browser === 'undefined' || !browser.permissions) return Promise.resolve(true);
  return browser.permissions.request({ origins: BLADE_ORIGINS });
}

document.addEventListener('DOMContentLoaded', async () => {
  const accessNotice = document.getElementById('access-notice') as HTMLDivElement;
  const btnGrant = document.getElementById('btn-grant') as HTMLButtonElement;
  const form = document.getElementById('config-form') as HTMLFormElement;
  const modelInput = document.getElementById('model') as HTMLInputElement;
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  const toggleKeyBtn = document.getElementById('toggle-key') as HTMLButtonElement;
  const btnTest = document.getElementById('btn-test') as HTMLButtonElement;
  const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
  const statusBanner = document.getElementById('status-banner') as HTMLDivElement;
  const eyeIcon = document.getElementById('eye-icon') as HTMLElement;
  const eyeOffIcon = document.getElementById('eye-off-icon') as HTMLElement;
  const keySaved = document.getElementById('key-saved') as HTMLElement;
  const keyLink = document.getElementById('key-link') as HTMLElement;

  /**
   * Met à jour la ligne d'aide sous le champ clé selon qu'une clé est enregistrée.
   *
   * @param hasKey - Vrai si une clé est stockée.
   */
  function updateKeyHint(hasKey: boolean): void {
    keySaved.hidden = !hasKey;
    keyLink.hidden = hasKey;
  }

  // 1. Chargement des préférences enregistrées
  const config = await getStoredConfig();
  modelInput.value = config.model || DEFAULT_CONFIG.model;
  apiKeyInput.value = config.apiKey || '';
  updateKeyHint(Boolean(config.apiKey));

  // 2. Bascule visuelle de masquage / affichage de la clé d'API
  toggleKeyBtn.addEventListener('click', () => {
    const reveal = apiKeyInput.type === 'password';
    apiKeyInput.type = reveal ? 'text' : 'password';
    eyeIcon.hidden = reveal;
    eyeOffIcon.hidden = !reveal;
    toggleKeyBtn.setAttribute('aria-label', reveal ? 'Masquer la clé' : 'Afficher la clé');
  });

  /**
   * Affiche un bandeau d'état temporaire dans l'interface popup.
   *
   * @param type - Type de message ("success", "error" ou "loading").
   * @param text - Libellé textuel affiché à l'utilisateur.
   */
  function showStatus(type: 'success' | 'error' | 'loading', text: string): void {
    statusBanner.className = `status-banner ${type}`;
    statusBanner.textContent = text;
    statusBanner.hidden = false;
  }

  /**
   * Affiche l'avis d'autorisation si l'accès à blade.sh n'est pas accordé.
   */
  async function syncAccessNotice(): Promise<void> {
    try {
      accessNotice.hidden = await hasBladeAccess();
    } catch {
      accessNotice.hidden = true;
    }
  }

  // 2b. Autorisation d'accès (requête directe dans le geste utilisateur)
  btnGrant.addEventListener('click', () => {
    requestBladeAccess()
      .then((granted) => {
        accessNotice.hidden = granted;
        if (granted) showStatus('success', 'Accès autorisé');
        else showStatus('error', 'Accès refusé : Marvin ne pourra pas répondre');
      })
      .catch((err: any) => showStatus('error', `Erreur: ${err.message}`));
  });
  await syncAccessNotice();

  // 3. Test de connectivité vers l'API blade.sh
  btnTest.addEventListener('click', async () => {
    const model = modelInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!model || !apiKey) {
      showStatus('error', 'Tous les champs sont requis pour le test');
      return;
    }

    btnTest.disabled = true;
    btnSave.disabled = true;
    showStatus('loading', 'Test en cours…');

    try {
      const resp = await browser.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        payload: { model, apiKey }
      });

      if (resp?.success) {
        showStatus('success', 'Connexion établie');
      } else {
        showStatus('error', resp?.error ? resp.error : 'Échec de connexion');
      }
    } catch (err: any) {
      showStatus('error', `Erreur: ${err.message}`);
    } finally {
      await syncAccessNotice();
      btnTest.disabled = false;
      btnSave.disabled = false;
    }
  });

  // 4. Sauvegarde de la configuration dans le stockage WebExtension
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const model = modelInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!model || !apiKey) {
      showStatus('error', 'Tous les champs sont requis');
      return;
    }

    btnSave.disabled = true;
    try {
      await saveStoredConfig({ model, apiKey });
      showStatus('success', 'Enregistré');
      updateKeyHint(true);
      setTimeout(() => {
        statusBanner.hidden = true;
      }, 3000);
    } catch (err: any) {
      showStatus('error', `Erreur: ${err.message}`);
    } finally {
      btnSave.disabled = false;
    }
  });
});
