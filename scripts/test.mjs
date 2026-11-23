/**
 * @fileoverview Lance la suite de tests : bundle tests/*.test.ts avec esbuild, puis exécute node --test.
 * Aucune dépendance supplémentaire : esbuild et node:test suffisent.
 * @module scripts/test
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();
const testsDir = path.join(root, 'tests');

const entryPoints = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => path.join(testsDir, f));

if (entryPoints.length === 0) {
  console.error('Aucun fichier tests/*.test.ts trouvé.');
  process.exit(1);
}

const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'marvin-test-'));

try {
  await esbuild.build({
    entryPoints,
    outdir,
    outbase: testsDir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outExtension: { '.js': '.mjs' },
    logLevel: 'warning'
  });

  const outputs = fs
    .readdirSync(outdir)
    .filter((f) => f.endsWith('.test.mjs'))
    .map((f) => path.join(outdir, f));

  const result = spawnSync(process.execPath, ['--test', ...outputs], { stdio: 'inherit', cwd: root });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(outdir, { recursive: true, force: true });
}
