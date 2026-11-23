/**
 * Tests de la conversion Ollama <-> OpenAI (src/background/openai.ts).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { toOpenAIRequest, fromOpenAIResponse } from '../src/background/openai';

describe('toOpenAIRequest', () => {
  test('chat simple et options', () => {
    const out: any = toOpenAIRequest(
      {
        messages: [{ role: 'user', content: 'salut', images: ['x'] }],
        options: { temperature: 0.2, top_p: 0.8, num_ctx: 4096, num_predict: 100 }
      },
      'm1'
    );
    assert.deepEqual(out, {
      model: 'm1',
      messages: [{ role: 'user', content: 'salut' }],
      stream: false,
      temperature: 0.2,
      top_p: 0.8,
      max_tokens: 100
    });
  });

  test('message outil orphelin supprimé', () => {
    const out: any = toOpenAIRequest(
      {
        messages: [
          { role: 'tool', content: 'orphelin' },
          { role: 'user', content: 'salut' }
        ]
      },
      'm'
    );
    assert.deepEqual(out.messages, [{ role: 'user', content: 'salut' }]);
  });

  test('tool_calls et résultats appariés par nom puis par ordre', () => {
    const out: any = toOpenAIRequest(
      {
        messages: [
          {
            role: 'assistant',
            tool_calls: [
              { function: { name: 'a', arguments: { x: 1 } } },
              { function: { name: 'b', arguments: '{"y":2}' } }
            ]
          },
          { role: 'tool', content: 'rb', tool_name: 'b' },
          { role: 'tool', content: 'ra' }
        ],
        tools: [{ type: 'function', function: { name: 'a' } }]
      },
      'm'
    );
    const [asst, t1, t2] = out.messages;
    assert.equal(asst.content, '');
    assert.deepEqual(asst.tool_calls, [
      { id: 'call_0', type: 'function', function: { name: 'a', arguments: '{"x":1}' } },
      { id: 'call_1', type: 'function', function: { name: 'b', arguments: '{"y":2}' } }
    ]);
    assert.deepEqual(t1, { role: 'tool', tool_call_id: 'call_1', content: 'rb' });
    assert.deepEqual(t2, { role: 'tool', tool_call_id: 'call_0', content: 'ra' });
    assert.equal(out.tools.length, 1);
  });
});

describe('fromOpenAIResponse', () => {
  test('texte', () => {
    const r = fromOpenAIResponse({ model: 'm', choices: [{ message: { content: 'ok' } }] });
    assert.deepEqual(r, { model: 'm', done: true, message: { role: 'assistant', content: 'ok' } });
  });

  test('tool call et arguments invalides conservés en chaîne', () => {
    const r = fromOpenAIResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'c1', function: { name: 'a', arguments: '{"x":1}' } },
              { id: 'c2', function: { name: 'b', arguments: '{bad' } }
            ]
          }
        }
      ]
    });
    assert.equal(r.message?.content, '');
    assert.deepEqual(r.message?.tool_calls, [
      { function: { name: 'a', arguments: { x: 1 } } },
      { function: { name: 'b', arguments: '{bad' } }
    ]);
  });

  test('erreur ou choix vides lèvent une exception', () => {
    assert.throws(() => fromOpenAIResponse({ error: { message: 'quota' } }), /quota/);
    assert.throws(() => fromOpenAIResponse({ choices: [] }), /aucun choix/);
  });
});
