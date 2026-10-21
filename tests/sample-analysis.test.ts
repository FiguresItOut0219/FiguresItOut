import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeSample, parseParts } from '../src/services/sampleAnalysis'
const part = { material: 'Metal', color: '银色', style: '珠链', description: 'Metal (bead chain)', point: [310, 120], label: [100, 100] }
test('parses model JSON and requires human confirmation', () => {
  const result = parseParts('```json\n' + JSON.stringify({ parts: [part] }) + '\n```')
  assert.equal(result[0]?.confirmed, false)
  assert.deepEqual(result[0]?.point, [310, 120])
})
test('rejects missing descriptions, empty results and invalid coordinates', () => {
  for (const p of [{ ...part, point: [1001, 2] }, { ...part, point: ['50', 20] }, { ...part, description: null }]) assert.throws(() => parseParts(JSON.stringify({ parts: [p] })))
  assert.throws(() => parseParts('{"parts":[]}'))
})
test('sends image input and selected model using the configured endpoint', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://api.deepseek.com/chat/completions')
    const body = JSON.parse(String(init?.body))
    assert.equal(body.model, 'deepseek-flash')
    assert.equal(body.messages[0].content[1].image_url.url, 'data:image/png;base64,test')
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-key')
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ parts: [part] }) } }] }))
  }
  try { assert.equal((await analyzeSample({ key: 'test-key', model: 'deepseek-flash', endpoint: 'https://api.deepseek.com/chat/completions' }, 'data:image/png;base64,test', '', new AbortController().signal)).length, 1) }
  finally { globalThis.fetch = original }
})
