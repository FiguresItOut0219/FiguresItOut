/**
 * 行情数据源层 —— Pages Function 与 Cron Worker 共用。
 *
 * 多源 + 自动降级，因为单一上游都不可靠：
 *   腾讯  行情字段最丰富（52 周高低、量比、换手、市净率直接给），A股/港股 K 线稳定，
 *         但美股历史 K 线在这个接口只能拿到 1~2 条，等于不可用
 *   雅虎  全市场 K 线都稳（实测 AAPL / 600519 / 0700.HK 各 10/10 全通），JSON，无编码问题
 *   东财  唯一提供行业板块与涨跌家数的源，但限流最严重
 *
 * 对外统一输出「东财兼容」的 JSON 形状，这样前端 src/services/marketApi.ts 无需改动：
 *   行情 { data: { diff: [{ f12, f14, f2, f3, f4, f5, f6 }] } }
 *   K 线 { data: { klines: ["date,open,close,high,low,volume,amount,amplitude"] } }
 *
 * ⚠️ 腾讯的行情接口返回 GBK 编码。这里用 TextDecoder('gbk') 解，并做两层校验：
 *    不支持该编码会抛错，解错了会出现 U+FFFD——两种都判定失败并降级到下一个源。
 */

/* ------------------------------------------------------------------ 代码归一化 */

export interface ResolvedCode {
  /** 东财 secid，如 1.600519 */
  secid: string
  /** 规范化展示代码，如 600519 / 00700 / AAPL */
  display: string
  market: 'A股' | '港股' | '美股'
  /** 腾讯代码，如 sh600519 / hk00700 / usAAPL */
  tencent: string
  /** 雅虎代码，如 600519.SS / 0700.HK / AAPL */
  yahoo: string
}

const padStart = (value: string, length: number) => value.padStart(length, '0')

/**
 * 支持 600519 / sh600519 / sz000001 / hk00700 / 00700 / AAPL / usAAPL。
 * 也接受 secid 形式（1.600519、116.00700、105.AAPL），原样透传。
 */
export function resolveCode(raw: string): ResolvedCode | null {
  const input = raw.trim().toUpperCase()
  if (!input) return null

  // 已经是 secid
  const asSecid = input.match(/^(\d+)\.([0-9A-Z.]+)$/)
  if (asSecid) {
    const marketFlag = asSecid[1]
    const rest = asSecid[2]
    if (marketFlag === '1' || marketFlag === '0') {
      const isShanghai = marketFlag === '1'
      return {
        secid: input,
        display: rest,
        market: 'A股',
        tencent: `${isShanghai ? 'sh' : 'sz'}${rest}`,
        yahoo: `${rest}.${isShanghai ? 'SS' : 'SZ'}`,
      }
    }
    if (marketFlag === '116') {
      return { secid: input, display: padStart(rest, 5), market: '港股', tencent: `hk${padStart(rest, 5)}`, yahoo: `${padStart(rest, 4)}.HK` }
    }
    if (marketFlag === '105') {
      return { secid: input, display: rest, market: '美股', tencent: `us${rest}`, yahoo: rest }
    }
    return null
  }

  // 港股：带 HK 前缀的 1~5 位数字，或裸 5 位数字（6 位的是深市，不会冲突）
  const hk = input.match(/^(?:HK)?(\d{1,5})$/)
  if (hk && (input.startsWith('HK') || hk[1].length === 5)) {
    const display = padStart(hk[1], 5)
    return { secid: `116.${display}`, display, market: '港股', tencent: `hk${display}`, yahoo: `${padStart(hk[1], 4)}.HK` }
  }

  const us = input.match(/^(?:US)?([A-Z][A-Z.\-]{0,9})$/)
  if (us && !/^\d/.test(input)) {
    return { secid: `105.${us[1]}`, display: us[1], market: '美股', tencent: `us${us[1]}`, yahoo: us[1] }
  }

  const sh = input.match(/^(?:SH|SZ)?(\d{6})$/)
  if (sh) {
    const digits = sh[1]
    const isShanghai = digits.startsWith('6') || digits.startsWith('5') || digits.startsWith('9')
    return {
      secid: `${isShanghai ? '1' : '0'}.${digits}`,
      display: digits,
      market: 'A股',
      tencent: `${isShanghai ? 'sh' : 'sz'}${digits}`,
      yahoo: `${digits}.${isShanghai ? 'SS' : 'SZ'}`,
    }
  }
  return null
}

/** 把「原始代码」或「secid」统一转成 secid */
export function toSecid(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d+\.[0-9A-Z.]+$/.test(trimmed)) return trimmed
  return resolveCode(trimmed)?.secid ?? null
}

/* ------------------------------------------------------------------ HTTP 工具 */

const QQ_HEADERS = { Referer: 'https://gu.qq.com/', 'User-Agent': 'Mozilla/5.0 (compatible; agency-portfolio/1.0)' }
const EM_HEADERS = { Referer: 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0 (compatible; agency-portfolio/1.0)' }
const YH_HEADERS = { Referer: 'https://finance.yahoo.com/', 'User-Agent': 'Mozilla/5.0 (compatible; agency-portfolio/1.0)' }

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 带有限重试的取数。对网络错误与 5xx 重试，4xx 直接放弃 */
async function getWithRetry(url: string, headers: Record<string, string>, attempts = 4): Promise<Response | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { headers }).catch(() => null)
    if (response?.ok) return response
    if (response && response.status < 500) return response
    await delay(400 * 2 ** attempt)
  }
  return null
}

async function getJsonWithRetry<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  const response = await getWithRetry(url, headers)
  if (!response?.ok) return null
  return response.json().catch(() => null)
}

/** GBK 解码，带能力校验。返回 null 表示这个源用不了，调用方应降级 */
async function decodeGbk(response: Response): Promise<string | null> {
  try {
    const text = new TextDecoder('gbk').decode(await response.arrayBuffer())
    // 解错会出现替换符；正常的中文股票名不会含 U+FFFD
    if (!text || text.includes('\uFFFD')) return null
    return text
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ 解析：腾讯行情 */

/**
 * 腾讯行情是 `v_sh600519="1~名称~代码~现价~昨收~今开~成交量(手)~..."` 的管道分隔文本。
 * 字段位序来自实测，关键下标：
 *   1 名称  3 现价  4 昨收  6 成交量(手)
 *   31 涨跌额  32 涨跌幅%  33 最高  34 最低
 *   35 "现价/成交量(手)/成交额(元)"
 *   37 成交额(万)  38 换手率  39 市盈率  43 振幅
 *   47 52周最高  48 52周最低  49 量比
 */
function parseTencentQuotes(text: string, wanted: ResolvedCode[]): Array<Record<string, string | number>> {
  const bySymbol = new Map(wanted.map((item) => [item.tencent, item]))
  const rows: Array<Record<string, string | number>> = []

  for (const match of text.matchAll(/v_([a-z]{2}[0-9A-Z.]+)="([^"]*)"/g)) {
    const resolved = bySymbol.get(match[1])
    if (!resolved) continue
    const f = match[2].split('~')
    if (f.length < 50) continue

    const price = Number(f[3])
    const change = Number(f[31])
    const changePct = Number(f[32])
    // f[35] 形如 1410.27/32373/4536814518，第三段是成交额（元）
    const amount = Number(f[35]?.split('/')[2] ?? 0) || Number(f[37]) * 10000

    rows.push({
      f12: resolved.display,
      f14: f[1] || resolved.display,
      f2: price,
      f3: Number.isFinite(changePct) ? changePct : 0,
      f4: Number.isFinite(change) ? change : 0,
      f5: Number(f[6]) || 0,
      f6: Number.isFinite(amount) ? amount : 0,
    })
  }
  return rows
}

/* ------------------------------------------------------------------ 解析：腾讯指数 */

/** 简版指数 `v_s_sh000001="1~上证指数~000001~3655.83~-24.81~-0.67~..."` */
function parseTencentIndices(text: string): Array<Record<string, string | number>> {
  const rows: Array<Record<string, string | number>> = []
  for (const match of text.matchAll(/v_s_([a-z]{2}[0-9]+)="([^"]*)"/g)) {
    const f = match[2].split('~')
    if (f.length < 6) continue
    rows.push({ f12: f[2] ?? '', f14: f[1] ?? '', f2: Number(f[3]) || 0, f4: Number(f[4]) || 0, f3: Number(f[5]) || 0 })
  }
  return rows
}

/* ------------------------------------------------------------------ 解析：雅虎 */

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: { gmtoffset?: number; longName?: string; shortName?: string; symbol?: string; regularMarketPrice?: number; previousClose?: number; regularMarketVolume?: number }
      timestamp?: number[]
      indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> }
    }>
    error?: unknown
  }
}

function yahooDate(timestamp: number, offset: number): string {
  return new Date((timestamp + offset) * 1000).toISOString().slice(0, 10)
}

function parseYahooKlines(payload: YahooChart | null): string[] {
  const result = payload?.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const quote = result?.indicators?.quote?.[0]
  if (!timestamps.length || !quote?.close) return []

  const offset = result?.meta?.gmtoffset ?? 0
  const lines: string[] = []
  for (let i = 0; i < timestamps.length; i += 1) {
    const open = quote.open?.[i]
    const close = quote.close?.[i]
    const high = quote.high?.[i]
    const low = quote.low?.[i]
    if (open == null || close == null || high == null || low == null) continue
    const volume = quote.volume?.[i] ?? 0
    const amplitude = low > 0 ? ((high - low) / low) * 100 : 0
    lines.push(`${yahooDate(timestamps[i], offset)},${open},${close},${high},${low},${volume},0,${amplitude.toFixed(2)}`)
  }
  return lines
}

function parseYahooQuote(payload: YahooChart | null, resolved: ResolvedCode): Record<string, string | number> | null {
  const meta = payload?.chart?.result?.[0]?.meta
  if (!meta || meta.regularMarketPrice == null) return null
  const price = meta.regularMarketPrice
  const prevClose = meta.previousClose ?? price
  return {
    f12: resolved.display,
    f14: meta.longName ?? meta.shortName ?? resolved.display,
    f2: price,
    f3: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    f4: price - prevClose,
    f5: meta.regularMarketVolume ?? 0,
    f6: 0,
  }
}

/* ------------------------------------------------------------------ 解析：腾讯 K 线 */

function parseTencentKlines(payload: unknown, symbol: string): string[] {
  const data = (payload as { data?: Record<string, { qfqday?: string[][]; day?: string[][] }> })?.data
  const node = data?.[symbol]
  // A 股走前复权键 qfqday，港股/美股走 day
  const rows = node?.qfqday ?? node?.day ?? []
  return rows.flatMap((row) => {
    if (row.length < 5) return []
    const [date, open, close, high, low, volume] = row
    const amplitude = Number(low) > 0 ? ((Number(high) - Number(low)) / Number(low)) * 100 : 0
    return [`${date},${open},${close},${high},${low},${volume},0,${amplitude.toFixed(2)}`]
  })
}

/* ------------------------------------------------------------------ 对外接口 */

export interface SourceResult<T> {
  data: T
  /** 实际提供数据的源，用于响应头与排查 */
  source: 'tencent' | 'yahoo' | 'eastmoney'
}

export async function fetchQuotes(codes: ResolvedCode[]): Promise<SourceResult<{ diff: Array<Record<string, string | number>> }>> {
  const symbols = codes.map((item) => item.tencent).join(',')

  // ① 腾讯
  const qq = await getWithRetry(`https://qt.gtimg.cn/q=${symbols}`, QQ_HEADERS)
  if (qq?.ok) {
    const text = await decodeGbk(qq)
    const rows = text ? parseTencentQuotes(text, codes) : []
    if (rows.length) return { data: { diff: rows }, source: 'tencent' }
  }

  // ② 雅虎
  const rows: Array<Record<string, string | number>> = []
  for (const code of codes) {
    const payload = await getJsonWithRetry<YahooChart>(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code.yahoo)}?range=5d&interval=1d`,
      YH_HEADERS,
    )
    const row = parseYahooQuote(payload, code)
    if (row) rows.push(row)
  }
  if (rows.length) return { data: { diff: rows }, source: 'yahoo' }

  // ③ 东财
  const em = await getJsonWithRetry<{ data?: { diff?: Array<Record<string, number | string>> } }>(
    `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=${codes.map((item) => item.secid).join(',')}&fields=f2,f3,f4,f5,f6,f12,f14`,
    EM_HEADERS,
  )
  return { data: { diff: em?.data?.diff ?? [] }, source: 'eastmoney' }
}

export async function fetchKlines(
  secid: string,
  limit = 120,
): Promise<SourceResult<{ klines: string[] }>> {
  const resolved = resolveCode(secid)
  if (!resolved) return { data: { klines: [] }, source: 'eastmoney' }

  // ① 雅虎：全市场都稳，作为首选
  const yahoo = await getJsonWithRetry<YahooChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolved.yahoo)}?range=1y&interval=1d`,
    YH_HEADERS,
  )
  const yahooLines = parseYahooKlines(yahoo)
  if (yahooLines.length >= 30) return { data: { klines: yahooLines.slice(-limit) }, source: 'yahoo' }

  // ② 腾讯：A股/港股可用；美股历史在这个接口只有 1~2 条，等于不可用
  if (resolved.market !== '美股') {
    const qq = await getJsonWithRetry<unknown>(
      `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${resolved.tencent},day,,,${limit},qfq`,
      QQ_HEADERS,
    )
    const qqLines = parseTencentKlines(qq, resolved.tencent)
    if (qqLines.length >= 30) return { data: { klines: qqLines.slice(-limit) }, source: 'tencent' }
  }

  // ③ 东财
  const em = await getJsonWithRetry<{ data?: { klines?: string[] } }>(
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&lmt=${limit}&end=20500101&fields1=f1,f2,f3,f4,f5&fields2=f51,f52,f53,f54,f55,f56,f57,f58`,
    EM_HEADERS,
  )
  return { data: { klines: em?.data?.klines ?? [] }, source: 'eastmoney' }
}

export async function fetchIndices(): Promise<SourceResult<{ diff: Array<Record<string, string | number>> }>> {
  // ① 腾讯简版指数，一个请求拿全部
  const qq = await getWithRetry(
    'https://qt.gtimg.cn/q=s_sh000001,s_sz399001,s_sz399006,s_sh000688,s_sz399005',
    QQ_HEADERS,
  )
  if (qq?.ok) {
    const text = await decodeGbk(qq)
    const rows = text ? parseTencentIndices(text) : []
    if (rows.length) return { data: { diff: rows }, source: 'tencent' }
  }

  // ② 雅虎
  const yahooSymbols = ['000001.SS', '399001.SZ', '399006.SZ', '000688.SS']
  const rows: Array<Record<string, string | number>> = []
  for (const symbol of yahooSymbols) {
    const payload = await getJsonWithRetry<YahooChart>(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`,
      YH_HEADERS,
    )
    const meta = payload?.chart?.result?.[0]?.meta
    if (meta?.regularMarketPrice == null) continue
    rows.push({
      f12: symbol.split('.')[0],
      f14: meta.shortName ?? symbol,
      f2: meta.regularMarketPrice,
      f3: meta.previousClose ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100 : 0,
      f4: meta.regularMarketPrice - (meta.previousClose ?? meta.regularMarketPrice),
    })
  }
  if (rows.length) return { data: { diff: rows }, source: 'yahoo' }

  // ③ 东财
  const em = await getJsonWithRetry<{ data?: { diff?: Array<Record<string, number | string>> } }>(
    'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006,1.000688,0.399005&fields=f2,f3,f4,f12,f14',
    EM_HEADERS,
  )
  return { data: { diff: em?.data?.diff ?? [] }, source: 'eastmoney' }
}
