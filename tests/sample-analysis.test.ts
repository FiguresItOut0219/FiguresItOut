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
test('merges identical beans at different positions but preserves different material, color or style', () => {
  const bean = { ...part, material: 'Plastic', color: '浅黄绿色', style: '笑脸豆子（上）', description: 'Plastic (light yellow-green smiling bean - top)' }
  const result = parseParts(JSON.stringify({ parts: [bean, { ...bean, style: '笑脸豆子（中）', point: [400, 500] }, { ...bean, style: '笑脸豆子（下）' }, { ...bean, color: '深绿色', style: '豆荚外壳' }, { ...bean, style: '哭脸豆子' }, { ...bean, material: 'Rubber' }] }))
  assert.equal(result.length, 3)
  assert.equal(result[0]?.style, '豆子')
  assert.equal(result[0]?.description, 'Plastic (light yellow-green bean)')
  assert.deepEqual(result[0]?.point, [310, 120])
  assert.equal(result[0]?.confirmed, false)
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
test('keeps normalized localization coordinates unchanged for non-square original images', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, init) => {
    calls++
    const body = JSON.parse(String(init?.body))
    if (calls === 2) assert.match(body.messages[0].content[0].text, /534 × 691/)
    const content = calls === 1 ? { parts: [part] } : { points: [{ id: 1, x: 500, y: 800 }] }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }))
  }
  try {
    const result = await analyzeSample({ key: 'test-key', model: 'qwen3.7-flash', endpoint: 'https://example.com/chat/completions' }, 'data:image/png;base64,test', '', new AbortController().signal, { width: 534, height: 691 })
    assert.equal(calls, 2)
    assert.equal(result[0]?.point[0], 500)
    assert.ok(Math.abs(result[0]!.point[1] - 800) < 0.001)
    assert.equal(result[0]?.label[1], result[0]?.point[1])
  } finally { globalThis.fetch = original }
})

test('ignores facial expressions while preserving physically different parts', () => {
  const bean = { ...part, material: 'Plastic', color: '浅黄绿色', style: '笑脸豆子（眯眼笑）', description: 'Plastic (light yellow-green squinting smiling bean)', descriptionZh: '塑料（浅黄绿色眯眼笑豆子）' }
  const result = parseParts(JSON.stringify({ parts: [bean, { ...bean, style: '笑脸豆子（波浪嘴）', description: 'Plastic (light yellow-green wavy mouth bean)' }, { ...bean, style: '豆荚外壳' }, { ...bean, style: '星形装饰' }] }))
  assert.equal(result.length, 3)
  assert.equal(result[0]?.style, '豆子')
  assert.equal(result[0]?.description, 'Plastic (light yellow-green bean)')
  assert.equal(result[0]?.descriptionZh, '塑料（浅黄绿色豆子）')
})

