/**
 * @fileoverview Contrôleur de l'interface utilisateur de configuration (Popup de la barre d'outils).
 * Permet à l'étudiant de définir son endpoint Ollama, sa clé d'API et son modèle préféré,
 * et de valider la connectivité en temps réel.
 * @module popup
 */

import '../webext';
import { getStoredConfig, saveStoredConfig } from '../config';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('config-form') as HTMLFormElement;
  const endpointInput = document.getElementById('endpoint') as HTMLInputElement;
  const modelInput = document.getElementById('model') as HTMLInputElement;
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  const toggleKeyBtn = document.getElementById('toggle-key') as HTMLButtonElement;
  const btnTest = document.getElementById('btn-test') as HTMLButtonElement;
  const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
  const statusBanner = document.getElementById('status-banner') as HTMLDivElement;

  // 1. Chargement des préférences enregistrées
  const config = await getStoredConfig();
  endpointInput.value = config.endpoint || 'https://ollama.com/api/chat';
  modelInput.value = config.model || 'gemma4:31b';
  apiKeyInput.value = config.apiKey || '';

  // 2. Bascule visuelle de masquage / affichage de la clé d'API
  toggleKeyBtn.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
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
    statusBanner.style.display = 'block';
  }

  // 3. Test de connectivité vers l'API Ollama
  btnTest.addEventListener('click', async () => {
    const endpoint = endpointInput.value.trim();
    const model = modelInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!endpoint || !model || !apiKey) {
      showStatus('error', 'Tous les champs sont requis pour le test');
      return;
    }

    btnTest.disabled = true;
    btnSave.disabled = true;
    showStatus('loading', 'Vérification en cours...');

    try {
      const resp = await browser.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        payload: { endpoint, model, apiKey }
      });

      if (resp?.success) {
        showStatus('success', '✓ Connexion établie');
      } else {
        showStatus('error', resp?.error ? `✗ ${resp.error}` : '✗ Échec de connexion');
      }
    } catch (err: any) {
      showStatus('error', `✗ Erreur: ${err.message}`);
    } finally {
      btnTest.disabled = false;
      btnSave.disabled = false;
    }
  });

  // 4. Sauvegarde de la configuration dans le stockage WebExtension
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const endpoint = endpointInput.value.trim();
    const model = modelInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!endpoint || !model || !apiKey) {
      showStatus('error', 'Tous les champs sont requis');
      return;
    }

    btnSave.disabled = true;
    try {
      await saveStoredConfig({ endpoint, model, apiKey });
      showStatus('success', '✓ Enregistré');
      setTimeout(() => {
        statusBanner.style.display = 'none';
      }, 3000);
    } catch (err: any) {
      showStatus('error', `Erreur: ${err.message}`);
    } finally {
      btnSave.disabled = false;
    }
  });
});
