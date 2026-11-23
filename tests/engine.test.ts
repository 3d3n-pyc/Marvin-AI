/**
 * Tests du moteur de chat (src/injected/chat/engine.ts) : prompt système et historique Ollama.
 * Un faux window minimal est installé avant l'import dynamique, car engine.ts touche window au chargement.
 */
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';

class FakeWindow extends EventTarget {
  posted: any[] = [];

  postMessage(data: any, _targetOrigin?: string): void {
    this.posted.push(data);
  }
}

let buildSystemPrompt: (pageContext: string, nowDate?: Date) => string;
let toOllamaHistory: (messages: any[]) => any[];
let mapChatError: (m: unknown) => string;
let parseToolArgs: (raw: unknown) => any;
let normalizeReply: (reply: unknown) => string;
let confirmSummary: (name: string, args: any, executed?: any[]) => string | null;
let runToolCalls: (calls: any[], messages: any[], executed: any[], hooks: any) => Promise<void>;

before(async () => {
  (globalThis as any).window = new FakeWindow();
  ({ mapChatError, buildSystemPrompt, toOllamaHistory, parseToolArgs, normalizeReply, confirmSummary, runToolCalls } = await import('../src/injected/chat/engine'));
});

describe('buildSystemPrompt', () => {
  test('contains the page context passed in', () => {
    const prompt = buildSystemPrompt('/student/projects?id=42', new Date('2025-03-03T10:00:00Z'));
    assert.ok(prompt.includes('/student/projects?id=42'));
    assert.ok(prompt.endsWith('Contexte de navigation actuel : /student/projects?id=42.'));
  });

  test('contains the date passed in, ISO and French long form', () => {
    const prompt = buildSystemPrompt('/', new Date('2025-03-03T10:00:00Z'));
    assert.ok(prompt.includes('(2025-03-03)'), 'date ISO du jour');
    assert.ok(prompt.includes('mars 2025'), 'date longue en français');
  });

  test('computes tomorrow from the date passed in', () => {
    const prompt = buildSystemPrompt('/', new Date('2025-03-03T10:00:00Z'));
    assert.ok(prompt.includes('Demain : '));
    assert.ok(prompt.includes('(2025-03-04)'));
  });

  test('handles an empty page context without throwing', () => {
    const prompt = buildSystemPrompt('', new Date('2025-03-03T10:00:00Z'));
    assert.ok(prompt.endsWith('Contexte de navigation actuel : .'));
  });
});

describe('toOllamaHistory', () => {
  test('returns an empty array for empty input', () => {
    assert.deepEqual(toOllamaHistory([]), []);
  });

  test('maps roles and keeps the order of simple messages', () => {
    const out = toOllamaHistory([
      { role: 'user', content: 'bonjour' },
      { role: 'assistant', content: 'salut' },
      { role: 'user', content: 'mes notes ?' }
    ]);
    assert.deepEqual(out, [
      { role: 'user', content: 'bonjour' },
      { role: 'assistant', content: 'salut' },
      { role: 'user', content: 'mes notes ?' }
    ]);
  });

  test('uses an empty string when content is missing', () => {
    assert.deepEqual(toOllamaHistory([{ role: 'user' }]), [{ role: 'user', content: '' }]);
  });

  test('treats an assistant message with an empty toolCalls array as plain text', () => {
    const out = toOllamaHistory([{ role: 'assistant', content: 'ok', toolCalls: [] }]);
    assert.deepEqual(out, [{ role: 'assistant', content: 'ok' }]);
  });

  test('expands an assistant message with toolCalls into tool_calls plus one tool message per call, in order', () => {
    const out = toOllamaHistory([
      { role: 'user', content: 'mes notes' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'c1', name: 'getEvaluations', arguments: {}, result: { ok: true } },
          { id: 'c2', name: 'getLogtime', arguments: { days: 14 }, result: { total: 3 } }
        ]
      }
    ]);
    assert.equal(out.length, 4);
    assert.deepEqual(out[0], { role: 'user', content: 'mes notes' });
    assert.deepEqual(out[1], {
      role: 'assistant',
      content: '',
      tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'getEvaluations', arguments: {} } },
        { id: 'c2', type: 'function', function: { name: 'getLogtime', arguments: { days: 14 } } }
      ]
    });
    assert.deepEqual(out[2], { role: 'tool', content: JSON.stringify({ ok: true }) });
    assert.deepEqual(out[3], { role: 'tool', content: JSON.stringify({ total: 3 }) });
  });

  test('throws a TypeError when the input is not an array', () => {
    assert.throws(() => toOllamaHistory(null as any), TypeError);
  });
});

describe('parseToolArgs', () => {
  test('parses JSON strings and objects, returns null on invalid input', () => {
    assert.deepEqual(parseToolArgs('{"a":1}'), { a: 1 });
    assert.deepEqual(parseToolArgs(''), {});
    assert.deepEqual(parseToolArgs(undefined), {});
    assert.equal(parseToolArgs('{oops'), null);
    assert.equal(parseToolArgs('[1]'), null);
  });
});

describe('runToolCalls with malformed calls', () => {
  test('feeds an error result to the model and continues', async () => {
    const messages: any[] = [];
    const executed: any[] = [];
    const hooks = { onTool() {}, confirm: async () => true };
    const calls = [{ function: { name: 'getLogtime', arguments: '{bad' } }, { id: 'x' }];
    await runToolCalls(calls, messages, executed, hooks);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].content, '{"error":"arguments invalides"}');
    assert.equal(executed.length, 0);
  });
});

describe('normalizeReply', () => {
  test('replaces empty or whitespace replies with a fallback', () => {
    for (const r of ['', '  \n', undefined, null]) assert.ok(normalizeReply(r).includes('réessaie'));
    assert.equal(normalizeReply('salut'), 'salut');
  });
});

describe('confirmSummary', () => {
  const inv = [{ name: 'getProjectInvitations', result: [{ memberId: 7, projet: 'Survivor' }] }];

  test('accept and decline use explicit verbs and include the project name', () => {
    assert.equal(confirmSummary('respondProjectInvitation', { memberId: 7, action: 'accept' }, inv), "Accepter l'invitation de groupe n°7 (projet Survivor)");
    assert.ok(confirmSummary('respondProjectInvitation', { memberId: 7, action: 'decline' }, inv)!.startsWith('Refuser'));
  });

  test('throws on an unknown action', () => {
    assert.throws(() => confirmSummary('respondProjectInvitation', { memberId: 7, action: 'maybe' }), /invalide/);
  });

  test('attendance mentions the event', () => {
    assert.ok(confirmSummary('confirmAttendance', { code: '4821', eventId: 5 })!.includes('n°5'));
    assert.ok(confirmSummary('confirmAttendance', { code: '4821' })!.includes('du jour'));
    assert.equal(confirmSummary('getLogtime', {}), null);
  });
});

describe('mapChatError', () => {
  test('maps known codes to French messages', () => {
    assert.match(mapChatError('HOST_PERMISSION_MISSING'), /Autoriser l'accès à blade\.sh/);
    assert.match(mapChatError('NETWORK_ERROR'), /injoignable/);
    assert.match(mapChatError('MISSING_API_KEY'), /clé manquante/);
  });

  test('passes unknown messages through', () => {
    assert.equal(mapChatError('HTTP 500'), 'HTTP 500');
  });
});
