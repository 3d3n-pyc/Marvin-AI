/**
 * @fileoverview Script de compilation et d'empaquetage de l'extension Marvin AI avec esbuild.
 * Génère des paquets de production dédiés pour Google Chrome (MV3) et Mozilla Firefox (MV3).
 * @module build
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

/** Indique si le script est exécuté en mode observation continue (--watch). */
const isWatch = process.argv.includes('--watch');

/** Répertoire temporaire de bundle esbuild */
const TEMP_BUNDLE_DIR = '.build-cache';

/** Points d'entrée de compilation TypeScript vers les bundles d'extension finaux. */
const entryPoints = [
  { in: 'src/background/background.ts', out: 'background' },
  { in: 'src/content/content.ts', out: 'content' },
  { in: 'src/injected/page-hook.ts', out: 'page-hook' },
  { in: 'src/popup/popup.ts', out: 'popup/popup' }
];

/** 
 * Options de compilation esbuild pour WebExtension.
 * @type {import('esbuild').BuildOptions}
 */
const buildOptions = {
  entryPoints,
  outdir: TEMP_BUNDLE_DIR,
  bundle: true,
  target: ['chrome109', 'firefox109'],
  format: 'iife',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  logLevel: 'info'
};

/**
 * Copie récursive d'un répertoire vers une destination.
 *
 * @param {string} src - Chemin source.
 * @param {string} dest - Chemin destination.
 */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Lecture de la version dynamique depuis package.json (source de vérité unique).
 */
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

/**
 * Manifest de base commun Manifest V3 conforme aux spécifications W3C / WebExtensions.
 */
const BASE_MANIFEST = {
  manifest_version: 3,
  name: 'MyEpitech - Marvin',
  version: packageJson.version,
  description: packageJson.description || 'Assistant Marvin officiel pour MyEpitech connecté à Ollama Cloud',
  permissions: ['storage', 'tabs'],
  host_permissions: ['*://my.epitech.eu/*', '*://ollama.com/*'],
  action: {
    default_icon: {
      '16': 'icons/marvin-16.png',
      '32': 'icons/marvin-32.png',
      '48': 'icons/marvin-48.png'
    },
    default_title: 'Marvin - Paramètres',
    default_popup: 'popup/popup.html'
  },
  content_scripts: [
    {
      matches: ['*://my.epitech.eu/*'],
      js: ['content.js'],
      run_at: 'document_start'
    }
  ],
  web_accessible_resources: [
    {
      resources: ['page-hook.js'],
      matches: ['*://my.epitech.eu/*']
    }
  ],
  icons: {
    '16': 'icons/marvin-16.png',
    '32': 'icons/marvin-32.png',
    '48': 'icons/marvin-48.png',
    '96': 'icons/marvin-96.png',
    '128': 'icons/marvin-128.png'
  }
};

/**
 * Génère le manifest spécifique Chrome (Chromium / Brave / Edge).
 */
function getChromeManifest() {
  return {
    ...BASE_MANIFEST,
    background: {
      service_worker: 'background.js'
    }
  };
}

/**
 * Génère le manifest spécifique Mozilla Firefox.
 */
function getFirefoxManifest() {
  return {
    ...BASE_MANIFEST,
    background: {
      scripts: ['background.js']
    },
    browser_specific_settings: {
      gecko: {
        id: 'marvin-unlock@myepitech',
        strict_min_version: '109.0'
      }
    }
  };
}

/**
 * Déploie les artefacts et le manifest approprié dans un répertoire cible.
 *
 * @param {string} targetDir - Répertoire cible (ex: "dist/chrome").
 * @param {object} manifest - Manifest JSON adapté.
 */
function deployTarget(targetDir, manifest) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'popup'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'icons'), { recursive: true });

  // Copie des bundles JS compilés
  fs.copyFileSync(path.join(TEMP_BUNDLE_DIR, 'background.js'), path.join(targetDir, 'background.js'));
  fs.copyFileSync(path.join(TEMP_BUNDLE_DIR, 'content.js'), path.join(targetDir, 'content.js'));
  fs.copyFileSync(path.join(TEMP_BUNDLE_DIR, 'page-hook.js'), path.join(targetDir, 'page-hook.js'));
  fs.copyFileSync(path.join(TEMP_BUNDLE_DIR, 'popup', 'popup.js'), path.join(targetDir, 'popup', 'popup.js'));

  // Copie des assets statiques popup
  fs.copyFileSync('src/popup/popup.html', path.join(targetDir, 'popup', 'popup.html'));
  fs.copyFileSync('src/popup/popup.css', path.join(targetDir, 'popup', 'popup.css'));

  // Copie des icônes
  if (fs.existsSync('src/assets/icons')) {
    copyDirRecursive('src/assets/icons', path.join(targetDir, 'icons'));
  }

  // Écriture du manifest
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Procédure de distribution post-compilation.
 */
function packageTargets() {
  // 1. Déploiement cible Google Chrome (dist/chrome)
  deployTarget('dist/chrome', getChromeManifest());

  // 2. Déploiement cible Mozilla Firefox (dist/firefox)
  deployTarget('dist/firefox', getFirefoxManifest());

  // Nettoyage du cache temporaire
  fs.rmSync(TEMP_BUNDLE_DIR, { recursive: true, force: true });
}

if (isWatch) {
  const ctx = await esbuild.context({
    ...buildOptions,
    plugins: [
      {
        name: 'post-build-dist',
        setup(build) {
          build.onEnd(() => {
            packageTargets();
            console.log('👀 Distribution Chrome & Firefox synchronisée.');
          });
        }
      }
    ]
  });
  await ctx.watch();
  console.log('👀 Mode watch actif... En attente de modifications.');
} else {
  const start = performance.now();
  await esbuild.build(buildOptions);
  packageTargets();
  const duration = (performance.now() - start).toFixed(1);
  console.log(`✨ Build de production terminé avec succès en ${duration}ms !`);
  console.log(`   📦 Chrome  : dist/chrome/`);
  console.log(`   🦊 Firefox : dist/firefox/`);
}
