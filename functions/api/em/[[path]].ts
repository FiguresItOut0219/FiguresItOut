/**
 * 行情代理 —— Cloudflare Pages Function，挂在 /api/em/*
 *
 * 与同目录的 contact.ts 同一套约定（onRequest* + env）。
 * 存在的理由：浏览器直连行情源有跨域风险，且无法共享缓存；
 * 由 Pages Function 在服务端取数、附加 CORS 头、写进 Cache API，两个问题一起解决。
 *
 * 多源降级逻辑在 shared/marketSources.ts（Pages Function 与 Cron Worker 共用）：
 *   行情/指数  腾讯 → 雅虎 → 东财
 *   K 线       雅虎 → 腾讯 → 东财
 *   板块/涨跌家数  仅东财（没有找到可靠替代，前端已做降级展示）
 *
 * 路由说明：同目录的 chat.ts 也匹配 /api/em/*，但按 Pages 规则
 * 「更具体的路由（通配符更少）优先」，/api/em/chat 会落到 chat.ts。
 */

import { fetchIndices, fetchKlines, fetchQuotes, resolveCode } from '../../../shared/marketSources'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

/**
 * Cloudflare 运行时特有的全局。项目没有安装 @cloudflare/workers-types，
 * 这里按本次用到的形状本地声明，避免为一个类型包装引入整个依赖。
 * 若之后要装：pnpm add -D @cloudflare/workers-types，再把这段删掉。
 */
declare const caches: {
  default: {
    match(request: string): Promise<Response | undefined>
    put(request: string, response: Response): Promise<void>
  }
}

const EASTMONEY_TOKEN = '7eea3edcaed734bea9cbfc24409ed989'
const UPSTREAM_HEADERS = {
  Referer: 'https://quote.eastmoney.com/',
  'User-Agent': 'Mozilla/5.0 (compatible; agency-portfolio-pages/1.0)',
  Accept: 'application/json',
}

/** 不同接口的合理缓存时长：行情短、K 线与板块长 */
const TTL: Record<string, number> = { indices: 15, quotes: 10, kline: 60, sectors: 60, breadth: 30 }

function shanghaiDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  })
    .format(now)
    .replaceAll('-', '')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8', 'Access-Control-Allow-Origin': '*' },
  })
}

function errorResponse(message: string, status = 502): Response {
  return jsonResponse({ error: message }, status)
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 对网络错误与 5xx 有限重试；4xx 直接放弃 */
async function getWithRetry(url: string, attempts = 4): Promise<Response | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { headers: UPSTREAM_HEADERS }).catch(() => null)
    if (response?.ok) return response
    if (response && response.status < 500) return response
    await delay(400 * 2 ** attempt)
  }
  return null
}

export async function onRequestGet(context: {
  request: Request
  env: Env
  params: Record<string, string | string[] | undefined>
  waitUntil: (promise: Promise<unknown>) => void
}) {
  const url = new URL(context.request.url)
  const segments = context.params.path
  const route = Array.isArray(segments) ? segments[0] : (segments ?? '')

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const cacheKey = url.pathname + url.search
  const cached = await caches.default.match(cacheKey)
  if (cached) {
    const headers = new Headers(cached.headers)
    headers.set('X-Cache', 'HIT')
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(cached.body, { status: cached.status, headers })
  }

  const ttl = TTL[route] ?? 30
  let payload: unknown
  let source = 'eastmoney'
  let status = 200

  switch (route) {
    case 'indices': {
      const result = await fetchIndices()
      payload = { data: result.data }
      source = result.source
      break
    }

    case 'quotes': {
      const raw = url.searchParams.get('codes') ?? ''
      const codes = raw
        .split(',')
        .map((item) => resolveCode(item))
        .filter((item): item is NonNullable<typeof item> => item !== null)
      if (!codes.length) return errorResponse('codes 参数无法解析', 400)
      const result = await fetchQuotes(codes)
      payload = { data: result.data }
      source = result.source
      break
    }

    case 'kline': {
      const code = url.searchParams.get('code') ?? ''
      if (!code) return errorResponse('缺少 code 参数', 400)
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 120), 20), 400)
      const result = await fetchKlines(code, limit)
      payload = { data: result.data }
      source = result.source
      break
    }

    case 'sectors': {
      const direction = url.searchParams.get('dir') === 'down' ? 'down' : 'up'
      const size = Math.min(Math.max(Number(url.searchParams.get('size') ?? 8), 1), 30)
      // fs 的冒号与加号必须百分号编码，裸 + 会被当作空格导致上游断开
      const upstream = await getWithRetry(
        `https://push2.eastmoney.com/api/qt/clist/get?fid=f3&pn=1&pz=${size}&po=${direction === 'up' ? 1 : 0}&np=1&fltt=2&invt=2&fs=m%3A90%2Bt%3A2&fields=f3,f14,f104,f128,f136`,
      )
      if (!upstream) return errorResponse('板块数据源暂时不可用')
      payload = await upstream.json()
      break
    }

    case 'breadth': {
      // 涨跌分布：一次拿到全市场分档，比翻 35 页 A 股列表轻得多
      const upstream = await getWithRetry(
        `https://push2ex.eastmoney.com/getTopicZDFenBu?ut=${EASTMONEY_TOKEN}&dpt=wz.ztzt&date=${shanghaiDate()}`,
      )
      if (!upstream) return errorResponse('涨跌分布数据源暂时不可用')
      payload = await upstream.json()
      break
    }

    default:
      return errorResponse(`未知接口 ${route}`, 404)
  }

  const fresh = new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'Cache-Control': `public, max-age=${ttl}`,
      'Access-Control-Allow-Origin': '*',
      // 便于在浏览器 Network 面板和生产日志里确认实际走了哪个源
      'X-Source': source,
      'X-Cache': 'MISS',
    },
  })

  // 只缓存成功且非空的响应，避免把上游故障缓存成一整段时间
  const bodyText = JSON.stringify(payload)
  if (bodyText.length > 2) context.waitUntil(caches.default.put(cacheKey, fresh.clone()))

  return fresh
}
