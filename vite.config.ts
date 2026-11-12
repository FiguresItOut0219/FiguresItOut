import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { fetchIndices, fetchKlines, fetchQuotes, resolveCode } from './shared/marketSources'

/** 北京时间 YYYYMMDD */
function shanghaiDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  })
    .format(new Date())
    .replaceAll('-', '')
}

const EASTMONEY_TOKEN = '7eea3edcaed734bea9cbfc24409ed989'
const UPSTREAM_HEADERS = {
  Referer: 'https://quote.eastmoney.com/',
  'User-Agent': 'Mozilla/5.0 (compatible; agency-portfolio-dev/1.0)',
  Accept: 'application/json',
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchEastmoney<T>(url: string, attempts = 4): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { headers: UPSTREAM_HEADERS }).catch(() => null)
    if (response?.ok) return (await response.json()) as T
    if (response && response.status < 500) return null
    await delay(400 * 2 ** attempt)
  }
  return null
}

/**
 * 本地开发的 /api/em/* 实现。
 *
 * 直接复用 shared/marketSources（Pages Function 和 Cron Worker 用的同一份），
 * 所以本地和线上的取数逻辑、降级顺序完全一致，不会出现「本地好的线上挂」。
 * 板块与涨跌家数只有东财有，这里直连。
 */
function emDevApi(): Plugin {
  return {
    name: 'em-dev-api',
    configureServer(server: ViteDevServer) {
      // 注意：不能用 middlewares.use('/api/em', ...)。Connect 会把挂载前缀从 req.url 里剥掉，
      // 里面拿到的就是 /indices 而不是 /api/em/indices。挂在根上自己判断路径最稳。
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
        if (!pathname.startsWith('/api/em/')) {
          next()
          return
        }

        const url = new URL(req.url ?? '/', 'http://localhost')
        const route = pathname.replace('/api/em/', '')

        const send = (status: number, body: unknown, source: string) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=UTF-8')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('X-Source', source)
          res.end(JSON.stringify(body))
        }

        try {
          switch (route) {
            case 'indices': {
              const result = await fetchIndices()
              return send(200, { data: result.data }, result.source)
            }
            case 'quotes': {
              const codes = (url.searchParams.get('codes') ?? '')
                .split(',')
                .map((item) => resolveCode(item))
                .filter((item): item is NonNullable<typeof item> => item !== null)
              if (!codes.length) return send(400, { error: 'codes 参数无法解析' }, 'none')
              const result = await fetchQuotes(codes)
              return send(200, { data: result.data }, result.source)
            }
            case 'kline': {
              const code = url.searchParams.get('code') ?? ''
              if (!code) return send(400, { error: '缺少 code 参数' }, 'none')
              const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 120), 20), 400)
              const result = await fetchKlines(code, limit)
              return send(200, { data: result.data }, result.source)
            }
            case 'sectors': {
              const direction = url.searchParams.get('dir') === 'down' ? 'down' : 'up'
              const size = Math.min(Math.max(Number(url.searchParams.get('size') ?? 8), 1), 30)
              const payload = await fetchEastmoney<unknown>(
                `https://push2.eastmoney.com/api/qt/clist/get?fid=f3&pn=1&pz=${size}&po=${direction === 'up' ? 1 : 0}&np=1&fltt=2&invt=2&fs=m%3A90%2Bt%3A2&fields=f3,f14,f104,f128,f136`,
              )
              if (!payload) return send(502, { error: '板块数据源暂时不可用' }, 'eastmoney')
              return send(200, payload, 'eastmoney')
            }
            case 'breadth': {
              const payload = await fetchEastmoney<unknown>(
                `https://push2ex.eastmoney.com/getTopicZDFenBu?ut=${EASTMONEY_TOKEN}&dpt=wz.ztzt&date=${shanghaiDate()}`,
              )
              if (!payload) return send(502, { error: '涨跌分布数据源暂时不可用' }, 'eastmoney')
              return send(200, payload, 'eastmoney')
            }
            case 'chat': {
              // AI 问股在本地开发不可用：没有服务端持有密钥。
              // 真要在本地测，用 pnpm wrangler pages dev + .dev.vars。
              return send(503, { configured: false, model: null, error: '本地开发不提供 AI 问股' }, 'none')
            }
            default:
              return send(404, { error: `未知接口 ${route}` }, 'none')
          }
        } catch (error) {
          return send(502, { error: String(error) }, 'none')
        }
      })
    },
  }
}

/**
 * AI 问股的本地通道（.env.local 里有 LLM_API_KEY 时可用）。
 *
 * 生产的密钥由 Pages Function 持有（见 functions/api/em/chat.ts），本地没有服务端，
 * 所以这里用中间件顶上：从 .env.local 读 LLM_API_KEY / LLM_API_BASE / LLM_MODEL，
 * 服务端注入密钥后转发，前端依旧只打同源 /api/em/chat。
 *
 * .env.local 已被 .gitignore 忽略，不要提交。
 */
function llmDevProxy(env: { LLM_API_KEY?: string; LLM_API_BASE?: string; LLM_MODEL?: string }): Plugin {
  const base = (env.LLM_API_BASE ?? 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = env.LLM_MODEL ?? 'gpt-4o-mini'
  const systemPrompt =
    '你是「股票智能分析工作台」里的问股助手。只能使用用户消息里【行情数据】JSON 中的数字，禁止编造。' +
    '数据里没有的信息直接说明。用简体中文，350 字以内，结尾附上「以上不构成投资建议」。'

  return {
    name: 'llm-dev-proxy',
    configureServer(server: ViteDevServer) {
      // 同上：挂在根上自己判断路径，避免 Connect 剥掉挂载前缀
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
        if (pathname !== '/api/em/chat') {
          next()
          return
        }
        // 没有密钥时交给 emDevApi 去回 503，保持提示一致
        if (!env.LLM_API_KEY) {
          next()
          return
        }
        if (req.method === 'GET') {
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ configured: true, model }))
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          void (async () => {
            try {
              const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
                question?: string
                history?: Array<{ role: string; content: string }>
                data?: unknown
              }
              const upstream = await fetch(`${base}/chat/completions`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model,
                  stream: true,
                  max_tokens: 800,
                  temperature: 0.3,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    ...(payload.history ?? []),
                    { role: 'user', content: `【行情数据】\n${JSON.stringify(payload.data ?? {})}\n\n【问题】${payload.question ?? ''}` },
                  ],
                }),
              })

              if (!upstream.ok || !upstream.body) {
                res.statusCode = 502
                res.setHeader('content-type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ error: `模型服务返回 ${upstream.status}` }))
                return
              }

              res.statusCode = 200
              res.setHeader('content-type', 'text/event-stream; charset=UTF-8')
              res.setHeader('cache-control', 'no-cache')
              const reader = upstream.body.getReader()
              for (;;) {
                const { done, value } = await reader.read()
                if (done) break
                res.write(Buffer.from(value))
              }
              res.end()
            } catch (error) {
              res.statusCode = 502
              res.setHeader('content-type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: `模型服务连接失败：${String(error)}` }))
            }
          })()
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // .env.local 里的 LLM_* 变量；Vite 不会自动把它们塞进 process.env，需显式 loadEnv
  const llm = loadEnv(mode, process.cwd(), 'LLM_')

  return {
    // 顺序有意义：llmDevProxy 先注册，没有密钥时调用 next() 落到 emDevApi 统一回 503
    plugins: [vue(), llmDevProxy(llm), emDevApi()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  }
})
