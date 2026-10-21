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
    const result = await analyzeSample({ key: 'test-key', model: 'qwen3.7-flash', endpoint: 'https://example.com/chat/completions' }, 'data:image/png;base64,test', '', new AbortController().signal, { width: 534, height: 691 }, true)
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

test('retries incomplete HTTP or model JSON once and does not expose parser errors', async () => {
  const original = globalThis.fetch
  try {
    for (const broken of ['', '{"choices":', JSON.stringify({ choices: [{ message: { content: '{"parts":' } }] })]) {
      let calls = 0
      globalThis.fetch = async () => {
        calls++
        return new Response(calls === 1 ? broken : JSON.stringify({ choices: [{ message: { content: JSON.stringify({ parts: [part] }) } }] }))
      }
      const result = await analyzeSample({ key: 'test', model: 'qwen3.7-flash', endpoint: 'https://example.com/api' }, 'data:image/png;base64,test', '', new AbortController().signal)
      assert.equal(calls, 2)
      assert.equal(result.length, 1)
    }
    let calls = 0
    globalThis.fetch = async () => { calls++; return new Response('') }
    await assert.rejects(() => analyzeSample({ key: 'test', model: 'qwen3.7-flash', endpoint: 'https://example.com/api' }, 'test', '', new AbortController().signal), /接口返回了空响应/)
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original }
})

test('default path performs only one request even when dimensions are supplied', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ parts: [part] }) } }] })) }
  try {
    const result = await analyzeSample({ key: 'test', model: 'qwen3.7-flash', endpoint: 'https://example.com/api' }, 'test', '', new AbortController().signal, { width: 534, height: 691 })
    assert.equal(calls, 1)
    assert.deepEqual(result[0]?.point, part.point)
    assert.equal(result[0]?.label[1], part.point[1])
  } finally { globalThis.fetch = original }
})
test('accepts bilingual descriptions and missing optional grouping metadata', () => {
  const result = parseParts(JSON.stringify({ parts: [{ point: [300, 500], description: { en: 'Metal (chain)', zh: '金属（链条）' } }, { point: [600, 400], description_en: 'Plastic (housing)', description_zh: '塑料（外壳）', color: null }] }))
  assert.equal(result[0]?.description, 'Metal (chain)')
  assert.equal(result[0]?.descriptionZh, '金属（链条）')
  assert.equal(result[1]?.description, 'Plastic (housing)')
  assert.equal(result[1]?.color, '')
})
test('retries a valid JSON response with missing required description once', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    const content = { parts: [calls === 1 ? { ...part, description: null } : part] }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }))
  }
  try {
    const result = await analyzeSample({ key: 'test', model: 'qwen3.7-flash', endpoint: 'https://example.com/api' }, 'test', '', new AbortController().signal)
    assert.equal(calls, 2)
    assert.equal(result[0]?.description, part.description)
  } finally { globalThis.fetch = original }
})
