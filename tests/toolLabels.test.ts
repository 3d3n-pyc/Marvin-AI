/**
 * Tests des libellés d'outils du panneau (src/injected/chat/toolLabels.ts).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { toolLabel } from '../src/injected/chat/toolLabels';
import { TOOL_DEFINITIONS } from '../src/injected/definitions';

describe('toolLabel', () => {
  test('nom connu', () => {
    assert.equal(toolLabel('getAbsences'), 'Lecture des absences');
  });

  test('nom inconnu : renvoie le nom', () => {
    assert.equal(toolLabel('unknownTool'), 'unknownTool');
    assert.equal(toolLabel('constructor'), 'constructor');
  });

  test('chaque outil de definitions.ts a un libellé', () => {
    for (const def of TOOL_DEFINITIONS) {
      const name = def.function.name;
      assert.notEqual(toolLabel(name), name, `libellé manquant : ${name}`);
    }
  });
});
