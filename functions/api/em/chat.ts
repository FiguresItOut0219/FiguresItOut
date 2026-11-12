/**
 * AI 问股 —— Cloudflare Pages Function，挂在 /api/em/chat
 *
 * 为什么必须走服务端：LLM 密钥一旦以 VITE_ 前缀进入前端，就会被打进浏览器包，
 * 任何人打开 DevTools 都能看到。所以密钥只存在于这里的环境变量里，前端只跟同源接口对话。
 *
 * 配置（Cloudflare Dashboard → Workers & Pages → 你的项目 → Settings → Environment variables）：
 *   LLM_API_KEY   必填，类型选 Secret（加密）
 *   LLM_API_BASE  可选，默认 https://api.openai.com/v1，任何 OpenAI 兼容端点都行
 *   LLM_MODEL     可选，默认 gpt-4o-mini
 *
 * 路由说明：同目录的 [[path]].ts 也匹配 /api/em/*，但按 Pages 的路由规则
 * 「更具体的路由（通配符更少）优先」，所以 /api/em/chat 会落到本文件。
 */

interface Env {
  LLM_API_KEY?: string
  LLM_API_BASE?: string
  LLM_MODEL?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPayload {
  question?: unknown
  history?: unknown
  data?: unknown
}

const MAX_QUESTION = 500
const MAX_HISTORY = 10
const MAX_TOKENS = 800

/** 简单的隔离内限流：每分钟 30 次。这只是减速带，不是真正的防护——
 *  要防滥用应该上 Cloudflare Turnstile 或 Access，见文档说明。 */
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000
let windowStart = Date.now()
let windowCount = 0

function rateLimited(): boolean {
  const now = Date.now()
  if (now - windowStart > RATE_WINDOW_MS) {
    windowStart = now
    windowCount = 0
  }
  windowCount += 1
  return windowCount > RATE_LIMIT
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8', 'Access-Control-Allow-Origin': '*' },
  })
}

const SYSTEM_PROMPT = `你是「股票智能分析工作台」里的问股助手。严格遵守：

1. 只能使用下方【行情数据】JSON 里的数字回答问题，禁止编造、估算或引用外部知识。
2. 数据里没有的信息，直接说「数据中没有这一项」，不要推测。
3. 涉及个股时，把技术指标（评分、评级、趋势、RSI、MACD、量比、均线、点位）讲清楚，并说明它属于技术面，不代表基本面。
4. 回答用简体中文，分点叙述，控制在 350 字以内。
5. 结尾必须附上：「以上由 AI 基于所给行情数据生成，不构成投资建议。」
6. 如果用户要求你预测涨跌或给出确定性买卖建议，拒绝并说明你只能解读已有数据。`

export async function onRequestGet(context: { env: Env }) {
  // 只告诉前端「有没有配密钥」和用的是哪个模型，绝不回传密钥本身
  return json({
    configured: Boolean(context.env.LLM_API_KEY),
    model: context.env.LLM_API_KEY ? (context.env.LLM_MODEL ?? 'gpt-4o-mini') : null,
  })
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  if (context.request.headers.get('content-type')?.includes('application/json') === false) {
    return json({ error: 'JSON requests only.' }, 415)
  }

  if (rateLimited()) {
    return json({ error: '请求过于频繁，请稍后再试。' }, 429)
  }

  if (!context.env.LLM_API_KEY) {
    return json({ error: '服务端未配置 LLM_API_KEY，AI 问股不可用。可继续使用规则引擎。' }, 503)
  }

  let payload: ChatPayload
  try {
    payload = (await context.request.json()) as ChatPayload
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const question = typeof payload.question === 'string' ? payload.question.trim().slice(0, MAX_QUESTION) : ''
  if (!question) return json({ error: '问题不能为空。' }, 400)

  const history: ChatMessage[] = Array.isArray(payload.history)
    ? payload.history
        .filter(
          (item): item is ChatMessage =>
            typeof item === 'object' &&
            item !== null &&
            (item as ChatMessage).role !== undefined &&
            typeof (item as ChatMessage).content === 'string',
        )
        .slice(-MAX_HISTORY)
    : []

  const data = typeof payload.data === 'object' && payload.data !== null ? payload.data : {}

  const base = (context.env.LLM_API_BASE ?? 'https://api.openai.com/v1').replace(/\/+$/, '')

  let upstream: Response
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: context.env.LLM_MODEL ?? 'gpt-4o-mini',
        stream: true,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: `【行情数据】\n${JSON.stringify(data)}\n\n【问题】${question}` },
        ],
      }),
    })
  } catch (error) {
    console.error('LLM upstream unreachable', error)
    return json({ error: '模型服务连接失败，请检查 LLM_API_BASE。' }, 502)
  }

  if (!upstream.ok) {
    // 不回传上游响应体，避免把密钥相关信息或内部细节漏给前端
    console.error('LLM upstream rejected', upstream.status)
    const hint = upstream.status === 401 ? 'API Key 无效或已过期' : upstream.status === 429 ? '模型服务限流' : '模型服务返回错误'
    return json({ error: `${hint}（${upstream.status}）` }, 502)
  }

  if (!upstream.body) return json({ error: '模型服务未返回数据流。' }, 502)

  // 直接把上游的 SSE 流转发给前端，由前端解析 delta
  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream; charset=UTF-8',
      'cache-control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
