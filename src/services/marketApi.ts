/**
 * 行情数据客户端。
 *
 * 所有请求都打同源的 `/api/em/*`，由 Cloudflare Pages Function 取数并附加 CORS 头与缓存。
 * 多源降级、代码归一化在 shared/marketSources.ts（Pages Function 与 Cron Worker 共用同一份），
 * 这里只负责浏览器侧的请求、重试与形状归一。
 *
 * 本地开发由 vite.config.ts 的中间件顶上，行为与生产一致。
 */

import type { Candle } from './indicators'
import { resolveCode, toSecid, type ResolvedCode } from '../../shared/marketSources'

// 代码归一化委托给共享层，UI 侧继续用这两个名字
export { resolveCode, toSecid } from '../../shared/marketSources'
export type { ResolvedCode } from '../../shared/marketSources'

/**
 * 接口根路径。浏览器里默认走同源 `/api/em`（由 Cloudflare Worker 代理）；
 * Node 环境（验证脚本、Worker 内的二次调用）可通过 globalThis.__EM_API_ROOT__ 覆盖。
 * 惰性读取，保证覆盖方总能在首次请求前生效。
 */
const apiRoot = () => (globalThis as { __EM_API_ROOT__?: string }).__EM_API_ROOT__ ?? '/api/em'

export class MarketApiError extends Error {
  constructor(message: string, readonly endpoint: string) {
    super(message)
    this.name = 'MarketApiError'
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 请求并解析 JSON。
 * 东方财富的行情接口有明显的间歇性抽风（实测同一 URL 连打多次会出现 socket hang up /
 * 连接被重置，属于上游限流），所以对网络错误和 5xx 做有限重试，退避 400/800/1600ms；
 * 4xx 是参数问题，重试没有意义，直接抛。
 */
async function getJson<T>(path: string, signal?: AbortSignal, attempts = 4): Promise<T> {
  let lastError: MarketApiError | null = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response
    try {
      response = await fetch(`${apiRoot()}${path}`, { signal, headers: { Accept: 'application/json' } })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      lastError = new MarketApiError('网络请求失败，请检查连接后重试', path)
    }

    if (response!) {
      if (!response!.ok) {
        // 4xx 不重试
        if (response!.status < 500) throw new MarketApiError(`上游返回 ${response!.status}`, path)
        lastError = new MarketApiError(`上游返回 ${response!.status}`, path)
      } else {
        const payload = await response!.json().catch(() => null)
        if (payload && typeof payload === 'object') return payload as T
        lastError = new MarketApiError('返回内容无法解析', path)
      }
    }

    if (attempt < attempts - 1) await delay(400 * 2 ** attempt)
  }

  throw lastError ?? new MarketApiError('请求失败', path)
}

/* ------------------------------------------------------------------ 类型定义 */

export interface IndexQuote {
  code: string
  name: string
  price: number
  change: number
  changePct: number
}

export interface StockQuote {
  secid: string
  code: string
  name: string
  market: ResolvedCode['market']
  price: number
  change: number
  changePct: number
  /** 成交量（手） */
  volume: number
  /** 成交额（元） */
  amount: number
}

export interface SectorQuote {
  name: string
  changePct: number
  upCount: number
  leader: string
  leaderChangePct: number
}

export interface BreadthBucket {
  /** 涨跌幅分档，单位 %；11 表示涨停档，-11 表示跌停档，0 表示平盘 */
  bucket: number
  count: number
}

export interface Breadth {
  up: number
  down: number
  flat: number
  limitUp: number
  limitDown: number
  total: number
  /** 涨跌分布分档明细，用于大盘复盘的分布图 */
  distribution: BreadthBucket[]
}

export interface MarketSnapshot {
  indices: IndexQuote[]
  sectorsUp: SectorQuote[]
  sectorsDown: SectorQuote[]
  breadth: Breadth | null
  /** 数据时间（北京时间 HH:mm） */
  updatedAt: string
}

/* ------------------------------------------------------------------ 请求 */

export async function fetchIndices(signal?: AbortSignal): Promise<IndexQuote[]> {
  const data = await getJson<{ data?: { diff?: Array<Record<string, number | string>> } }>('/indices', signal)
  return (data.data?.diff ?? []).map((item) => ({
    code: String(item.f12 ?? ''),
    name: String(item.f14 ?? ''),
    price: Number(item.f2 ?? 0),
    change: Number(item.f4 ?? 0),
    changePct: Number(item.f3 ?? 0),
  }))
}

export async function fetchQuotes(codes: string[], signal?: AbortSignal): Promise<StockQuote[]> {
  const resolved = codes.map(resolveCode).filter((item): item is ResolvedCode => item !== null)
  if (!resolved.length) return []
  const secids = resolved.map((item) => item.secid).join(',')
  const data = await getJson<{ data?: { diff?: Array<Record<string, number | string>> } }>(
    `/quotes?codes=${encodeURIComponent(secids)}`,
    signal,
  )
  // 上游按 f12 返回原始代码（港股不带前导零以外的格式差异），用规范化后的 display 反查
  const byDisplay = new Map(resolved.map((item) => [item.display, item]))
  return (data.data?.diff ?? []).flatMap((item) => {
    const resolvedCode = byDisplay.get(String(item.f12 ?? ''))
    if (!resolvedCode) return []
    return [
      {
        secid: resolvedCode.secid,
        code: resolvedCode.display,
        name: String(item.f14 ?? resolvedCode.display),
        market: resolvedCode.market,
        price: Number(item.f2 ?? 0),
        change: Number(item.f4 ?? 0),
        changePct: Number(item.f3 ?? 0),
        volume: Number(item.f5 ?? 0),
        amount: Number(item.f6 ?? 0),
      },
    ]
  })
}

/** 日 K 线。code 可以是原始代码（600519）或 secid（1.600519） */
export async function fetchCandles(code: string, limit = 120, signal?: AbortSignal): Promise<Candle[]> {
  const secid = toSecid(code)
  if (!secid) return []
  const data = await getJson<{ data?: { klines?: string[] } }>(
    `/kline?code=${encodeURIComponent(secid)}&limit=${limit}`,
    signal,
  )
  return (data.data?.klines ?? []).flatMap((line) => {
    const parts = line.split(',')
    if (parts.length < 7) return []
    return [
      {
        date: parts[0],
        open: Number(parts[1]),
        close: Number(parts[2]),
        high: Number(parts[3]),
        low: Number(parts[4]),
        volume: Number(parts[5]),
        amount: Number(parts[6]),
        amplitude: Number(parts[7] ?? 0),
      },
    ]
  })
}

export async function fetchSectors(direction: 'up' | 'down' = 'up', size = 8, signal?: AbortSignal): Promise<SectorQuote[]> {
  const data = await getJson<{ data?: { diff?: Array<Record<string, number | string>> } }>(
    `/sectors?dir=${direction}&size=${size}`,
    signal,
  )
  return (data.data?.diff ?? []).map((item) => ({
    name: String(item.f14 ?? ''),
    changePct: Number(item.f3 ?? 0),
    upCount: Number(item.f104 ?? 0),
    leader: String(item.f128 ?? ''),
    leaderChangePct: Number(item.f136 ?? 0),
  }))
}

/**
 * 涨跌家数。
 *
 * 生产环境由 Cloudflare Worker 聚合成 { up, down, flat, limitUp, limitDown, total }；
 * 本地开发时 Vite 代理直接把东方财富的原始响应转发回来（{ data: { fenbu: [...] } }）。
 * 这里统一做一次归一化，两种形态都能吃，页面逻辑不必区分环境。
 */
export async function fetchBreadth(signal?: AbortSignal): Promise<Breadth> {
  const data = await getJson<Record<string, unknown>>('/breadth', signal)

  const fenbu = (data as { data?: { fenbu?: Array<Record<string, number>> } }).data?.fenbu
  if (Array.isArray(fenbu) && fenbu.length) {
    const distribution: BreadthBucket[] = []
    let up = 0
    let down = 0
    let flat = 0
    for (const entry of fenbu) {
      for (const [key, value] of Object.entries(entry)) {
        const bucket = Number(key)
        distribution.push({ bucket, count: Number(value) })
        if (bucket > 0) up += Number(value)
        else if (bucket < 0) down += Number(value)
        else flat += Number(value)
      }
    }
    distribution.sort((a, b) => b.bucket - a.bucket)
    return {
      up,
      down,
      flat,
      limitUp: distribution.find((item) => item.bucket === 11)?.count ?? 0,
      limitDown: distribution.find((item) => item.bucket === -11)?.count ?? 0,
      total: up + down + flat,
      distribution,
    }
  }

  const { up, down, flat } = data
  if (typeof up !== 'number' || typeof down !== 'number' || typeof flat !== 'number') {
    throw new MarketApiError('涨跌分布数据暂不可用', '/breadth')
  }

  return {
    up,
    down,
    flat,
    limitUp: Number(data.limitUp ?? 0),
    limitDown: Number(data.limitDown ?? 0),
    total: Number(data.total ?? 0),
    distribution: [],
  }
}

/** 北京时间 HH:mm */
export function formatBeijingTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(date)
}

/* ------------------------------------------------------------------ AI 问股 */

export interface LlmStatus {
  /** 服务端是否配了 LLM_API_KEY。注意：接口绝不回传密钥本身 */
  configured: boolean
  model: string | null
}

export interface LlmHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

/** 探测服务端是否配置了 LLM 密钥 */
export async function fetchLlmStatus(signal?: AbortSignal): Promise<LlmStatus> {
  const data = await getJson<{ configured?: boolean; model?: string | null }>('/chat', signal)
  return { configured: Boolean(data.configured), model: data.model ?? null }
}

/**
 * AI 问股。密钥在服务端（Pages Function 环境变量），前端只发同源请求。
 * 流式返回：每收到一个 delta 就回调一次，全部结束后 resolve。
 */
export async function askLlm(
  payload: { question: string; history: LlmHistoryItem[]; data: Record<string, unknown> },
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${apiRoot()}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new MarketApiError('网络请求失败，请检查连接后重试', '/chat')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new MarketApiError((body as { error?: string })?.error ?? `服务端返回 ${response.status}`, '/chat')
  }
  if (!response.body) throw new MarketApiError('服务端未返回数据流', '/chat')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE 以空行分段，最后一段可能不完整，留给下一轮
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) onDelta(delta)
        } catch {
          /* 忽略无法解析的行 */
        }
      }
    }
  }
}
