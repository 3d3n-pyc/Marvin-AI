/**
 * Tests de la passerelle postMessage (src/injected/chat/bridge.ts).
 * Un faux window (EventTarget minimal) remplace le DOM ; aucune dépendance externe.
 */
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';

/** Faux window : EventTarget qui enregistre les postMessage et permet d'injecter des réponses. */
class FakeWindow extends EventTarget {
  posted: any[] = [];
  handlers = new Set<unknown>();

  addEventListener(type: string, listener: any, options?: any): void {
    if (type === 'message' && listener) this.handlers.add(listener);
    super.addEventListener(type, listener, options);
  }

  removeEventListener(type: string, listener: any, options?: any): void {
    if (type === 'message') this.handlers.delete(listener);
    super.removeEventListener(type, listener, options);
  }

  postMessage(data: any, _targetOrigin?: string): void {
    this.posted.push(data);
  }

  /** Injecte un message entrant (comme le ferait le content script). */
  dispatch(data: any): void {
    const ev = new Event('message');
    Object.defineProperty(ev, 'data', { value: data });
    this.dispatchEvent(ev);
  }
}

let fake: FakeWindow;
let callOllama: (payload: unknown, timeoutMs?: number) => Promise<any>;

/** Dernière requête émise vers le content script. */
function lastRequest(): any {
  const reqs = fake.posted.filter((m) => m && m.type === 'MARVIN_OLLAMA_CALL_REQ');
  return reqs[reqs.length - 1];
}

before(async () => {
  fake = new FakeWindow();
  (globalThis as any).window = fake;
  ({ callOllama } = await import('../src/injected/chat/bridge'));
});

describe('callOllama', () => {
  test('posts a request with a generated id and the payload', async () => {
    const p = callOllama({ model: 'm1' }, 10);
    const req = lastRequest();
    assert.ok(req, 'une requête doit être postée');
    assert.equal(typeof req.id, 'string');
    assert.ok(req.id.startsWith('ollama_'));
    assert.deepEqual(req.payload, { model: 'm1' });
    await assert.rejects(p);
  });

  test('resolves with data on a matching response', async () => {
    const p = callOllama({ model: 'm' });
    const req = lastRequest();
    fake.dispatch({ type: 'MARVIN_OLLAMA_CALL_RES', id: req.id, data: { message: { content: 'ok' } } });
    assert.deepEqual(await p, { message: { content: 'ok' } });
  });

  test('ignores responses with another id, then resolves on the right one', async () => {
    const p = callOllama({});
    const req = lastRequest();
    fake.dispatch({ type: 'MARVIN_OLLAMA_CALL_RES', id: 'ollama_other', data: { message: { content: 'mauvais' } } });
    fake.dispatch({ type: 'MARVIN_OLLAMA_CALL_RES', id: req.id, data: { message: { content: 'bon' } } });
    assert.deepEqual(await p, { message: { content: 'bon' } });
  });

  test('ignores messages without data or with another type', async () => {
    const p = callOllama({});
    const req = lastRequest();
    fake.dispatch(null);
    fake.dispatch({ type: 'SOMETHING_ELSE', id: req.id, data: 'x' });
    fake.dispatch({ type: 'MARVIN_OLLAMA_CALL_RES', id: req.id, data: { message: { content: 'final' } } });
    assert.deepEqual(await p, { message: { content: 'final' } });
  });

  test('rejects with the error message of an error response', async () => {
    const p = callOllama({});
    const req = lastRequest();
    fake.dispatch({ type: 'MARVIN_OLLAMA_CALL_RES', id: req.id, error: 'boom' });
    await assert.rejects(p, { message: 'boom' });
  });

  test('rejects after timeoutMs when no response arrives', async () => {
    await assert.rejects(callOllama({}, 20), { message: 'Délai dépassé (20 ms) en attendant blade.sh' });
  });

  test('removes its message listener after success, error and timeout', async () => {
    const baseline = fake.handlers.size;

    const ok = callOllama({});
    fake.dispatch({ type: 'MARVIN_OLLAMA_CALL_RES', id: lastRequest().id, data: {} });
    await ok;
    assert.equal(fake.handlers.size, baseline, 'listener retiré après succès');

    const ko = callOllama({});
    fake.dispatch({ type: 'MARVIN_OLLAMA_CALL_RES', id: lastRequest().id, error: 'x' });
    await assert.rejects(ko);
    assert.equal(fake.handlers.size, baseline, 'listener retiré après erreur');

    await assert.rejects(callOllama({}, 10));
    assert.equal(fake.handlers.size, baseline, 'listener retiré après délai dépassé');
  });
});
