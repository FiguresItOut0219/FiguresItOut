/**
 * 每日股票分析 —— 独立部署的 Cloudflare Worker，只做定时任务。
 *
 * 为什么单独一个 Worker：Cloudflare Pages Functions 不支持 Cron Trigger，
 * 而定时分析是「方式一」的核心，所以拆出来独立部署。它不托管任何页面，
 * 站点本身仍由 Pages 提供（见 functions/api/em/[[path]].ts 的行情代理）。
 *
 * 部署：pnpm wrangler deploy -c wrangler.cron.toml
 * 手动触发验证：pnpm wrangler deploy -c wrangler.cron.toml 后访问
 *   https://<worker>.workers.dev/run-now
 */

import { fetchIndices, fetchKlines, fetchQuotes, resolveCode } from '../shared/marketSources'
import { analyseStock } from '../src/services/stockAnalysis'

interface KvNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

export interface Env {
  STOCK_KV: KvNamespace
  /** 自选股，逗号分隔，如 600519,300750,hk00700,AAPL */
  STOCK_LIST?: string
  WECHAT_WEBHOOK_URL?: string
  FEISHU_WEBHOOK_URL?: string
  DISCORD_WEBHOOK_URL?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
  SLACK_BOT_TOKEN?: string
  SLACK_CHANNEL_ID?: string
}

const EASTMONEY_TOKEN = '7eea3edcaed734bea9cbfc24409ed989'
const UPSTREAM_HEADERS = {
  Referer: 'https://quote.eastmoney.com/',
  'User-Agent': 'Mozilla/5.0 (compatible; agency-portfolio-cron/1.0)',
  Accept: 'application/json',
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 东财专用：板块与涨跌家数只有这个源有。对网络错误与 5xx 有限重试；4xx 直接放弃 */
async function fetchEastmoney<T>(url: string, attempts = 4): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { headers: UPSTREAM_HEADERS }).catch(() => null)
    if (response?.ok) return (await response.json()) as T
    if (response && response.status < 500) return null
    await delay(400 * 2 ** attempt)
  }
  return null
}

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

function shanghaiTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(now)
}

function parseWatchlist(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean)
}

/* ------------------------------------------------------------------ 涨跌家数 */

interface Breadth {
  up: number
  down: number
  flat: number
  limitUp: number
  limitDown: number
  total: number
}

/** 一次拿涨跌分布 + 涨停池 + 跌停池，比翻 35 页 A 股列表轻得多 */
async function buildBreadth(date: string): Promise<Breadth> {
  const [distribution, upPool, downPool] = await Promise.all([
    fetchEastmoney<{ data?: { fenbu?: Array<Record<string, number>> } }>(
      `https://push2ex.eastmoney.com/getTopicZDFenBu?ut=${EASTMONEY_TOKEN}&dpt=wz.ztzt&date=${date}`,
    ),
    fetchEastmoney<{ data?: { tc?: number } }>(
      `https://push2ex.eastmoney.com/getTopicZTPool?ut=${EASTMONEY_TOKEN}&dpt=wz.ztzt&Pageindex=0&pagesize=1&sort=fbt%3Aasc&date=${date}`,
    ),
    fetchEastmoney<{ data?: { tc?: number } }>(
      `https://push2ex.eastmoney.com/getTopicDTPool?ut=${EASTMONEY_TOKEN}&dpt=wz.ztzt&Pageindex=0&pagesize=1&sort=fund%3Aasc&date=${date}`,
    ),
  ])

  const buckets = new Map<number, number>()
  for (const entry of distribution?.data?.fenbu ?? []) {
    for (const [key, value] of Object.entries(entry)) buckets.set(Number(key), Number(value))
  }

  let up = 0
  let down = 0
  let flat = 0
  for (const [bucket, count] of buckets) {
    if (bucket > 0) up += count
    else if (bucket < 0) down += count
    else flat += count
  }

  return {
    up,
    down,
    flat,
    limitUp: Number(upPool?.data?.tc ?? buckets.get(11) ?? 0),
    limitDown: Number(downPool?.data?.tc ?? buckets.get(-11) ?? 0),
    total: up + down + flat,
  }
}

/* ------------------------------------------------------------------ 报告 */

interface ReportEntry {
  code: string
  name: string
  market: string
  price: number
  changePct: number
  score: number
  rating: string
  trend: string
  summary: string
  risks: string[]
  catalysts: string[]
  asOf: string
}

interface DailyReport {
  date: string
  generatedAt: string
  breadth: Breadth
  indices: Array<{ name: string; price: number; changePct: number }>
  sectorsUp: Array<{ name: string; changePct: number }>
  sectorsDown: Array<{ name: string; changePct: number }>
  entries: ReportEntry[]
}

export async function runDailyAnalysis(env: Env): Promise<DailyReport | null> {
  const date = shanghaiDate()
  const breadth = await buildBreadth(date)

  // 涨跌分布返回空即当日非交易日，直接跳过，不写报告也不推送
  if (breadth.total === 0) {
    await env.STOCK_KV.put(`skip:${date}`, JSON.stringify({ date, reason: 'non-trading-day', checkedAt: shanghaiTime() }))
    return null
  }

  // 指数走共享多源层（腾讯 → 雅虎 → 东财）；板块只有东财有
  const [indicesResult, sectorsUpRaw, sectorsDownRaw] = await Promise.all([
    fetchIndices(),
    fetchEastmoney<{ data?: { diff?: Array<Record<string, number | string>> } }>(
      // fs 的冒号与加号必须百分号编码，裸 + 会被当作空格导致上游断开
      'https://push2.eastmoney.com/api/qt/clist/get?fid=f3&pn=1&pz=8&po=1&np=1&fltt=2&invt=2&fs=m%3A90%2Bt%3A2&fields=f3,f14,f104,f128,f136',
    ),
    fetchEastmoney<{ data?: { diff?: Array<Record<string, number | string>> } }>(
      'https://push2.eastmoney.com/api/qt/clist/get?fid=f3&pn=1&pz=8&po=0&np=1&fltt=2&invt=2&fs=m%3A90%2Bt%3A2&fields=f3,f14,f104,f128,f136',
    ),
  ])

  const indices = indicesResult.data.diff.map((item) => ({
    name: String(item.f14 ?? ''),
    price: Number(item.f2 ?? 0),
    changePct: Number(item.f3 ?? 0),
  }))
  const sectorsUp = (sectorsUpRaw?.data?.diff ?? []).map((item) => ({
    name: String(item.f14 ?? ''),
    changePct: Number(item.f3 ?? 0),
  }))
  const sectorsDown = (sectorsDownRaw?.data?.diff ?? []).map((item) => ({
    name: String(item.f14 ?? ''),
    changePct: Number(item.f3 ?? 0),
  }))

  const entries: ReportEntry[] = []
  for (const code of parseWatchlist(env.STOCK_LIST)) {
    const resolved = resolveCode(code)
    if (!resolved) continue

    // 行情与 K 线都走共享多源层，自动降级
    const [quotesResult, klineResult] = await Promise.all([fetchQuotes([resolved]), fetchKlines(resolved.secid, 120)])

    const raw = quotesResult.data.diff[0]
    if (!raw) continue

    const candles = klineResult.data.klines.flatMap((line) => {
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
    if (!candles.length) continue

    const analysis = analyseStock(
      {
        secid: resolved.secid,
        code: resolved.display,
        name: String(raw.f14 ?? resolved.display),
        market: resolved.market,
        price: Number(raw.f2 ?? 0),
        change: Number(raw.f4 ?? 0),
        changePct: Number(raw.f3 ?? 0),
        volume: Number(raw.f5 ?? 0),
        amount: Number(raw.f6 ?? 0),
      },
      candles,
    )

    entries.push({
      code: analysis.code,
      name: analysis.name,
      market: analysis.market,
      price: analysis.price,
      changePct: analysis.changePct,
      score: analysis.score,
      rating: analysis.rating,
      trend: analysis.trend,
      summary: analysis.signals.slice(0, 2).map((signal) => signal.label).join('、'),
      risks: analysis.risks.slice(0, 3),
      catalysts: analysis.catalysts.slice(0, 3),
      asOf: analysis.asOf,
    })
  }

  const report: DailyReport = {
    date,
    generatedAt: shanghaiTime(),
    breadth,
    indices,
    sectorsUp,
    sectorsDown,
    entries,
  }

  await env.STOCK_KV.put(`report:${date}`, JSON.stringify(report))
  await env.STOCK_KV.put('latest-report-date', date)
  await pushNotifications(env, report)
  return report
}

/* ------------------------------------------------------------------ 推送 */

function renderReportText(report: DailyReport): string {
  const counts = report.entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.rating] = (acc[entry.rating] ?? 0) + 1
    return acc
  }, {})
  const tally = Object.entries(counts).map(([rating, count]) => `${rating}:${count}`).join(' ') || '无数据'

  const lines: string[] = [
    `🎯 ${report.date} 决策仪表盘`,
    `共分析 ${report.entries.length} 只股票 | ${tally}`,
    '',
    `📊 市场概况：上涨 ${report.breadth.up} / 下跌 ${report.breadth.down} / 平盘 ${report.breadth.flat}，涨停 ${report.breadth.limitUp} / 跌停 ${report.breadth.limitDown}`,
  ]

  if (report.indices.length) {
    lines.push('', '📈 主要指数')
    for (const index of report.indices) lines.push(`- ${index.name}: ${index.price} (${index.changePct >= 0 ? '+' : ''}${index.changePct}%)`)
  }

  if (report.entries.length) {
    lines.push('', '🔍 个股要点')
    for (const entry of report.entries) {
      lines.push('', `${entry.name} (${entry.code}) ${entry.price} ${entry.changePct >= 0 ? '+' : ''}${entry.changePct}%`)
      lines.push(`评分 ${entry.score} | 评级 ${entry.rating} | 趋势 ${entry.trend}`)
      if (entry.summary) lines.push(`依据：${entry.summary}`)
      if (entry.risks.length) lines.push(`风险：${entry.risks.join('；')}`)
    }
  }

  if (report.sectorsUp.length) {
    lines.push('', `🔥 领涨板块：${report.sectorsUp.slice(0, 5).map((item) => `${item.name} ${item.changePct >= 0 ? '+' : ''}${item.changePct}%`).join('，')}`)
  }
  if (report.sectorsDown.length) {
    lines.push(`🧊 领跌板块：${report.sectorsDown.slice(0, 5).map((item) => `${item.name} ${item.changePct}%`).join('，')}`)
  }

  lines.push('', `生成时间 ${report.generatedAt}（北京时间）`, '由技术指标规则引擎生成，不构成投资建议。')
  return lines.join('\n')
}

async function pushNotifications(env: Env, report: DailyReport): Promise<void> {
  const text = renderReportText(report)
  const jobs: Array<Promise<unknown>> = []

  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }).catch(() => undefined)

  if (env.WECHAT_WEBHOOK_URL) jobs.push(post(env.WECHAT_WEBHOOK_URL, { msgtype: 'text', text: { content: text } }))
  if (env.FEISHU_WEBHOOK_URL) jobs.push(post(env.FEISHU_WEBHOOK_URL, { msg_type: 'text', text: { content: text } }))
  if (env.DISCORD_WEBHOOK_URL) jobs.push(post(env.DISCORD_WEBHOOK_URL, { content: text.slice(0, 1900) }))
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    jobs.push(post(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { chat_id: env.TELEGRAM_CHAT_ID, text }))
  }
  if (env.SLACK_BOT_TOKEN && env.SLACK_CHANNEL_ID) {
    jobs.push(post('https://slack.com/api/chat.postMessage', { channel: env.SLACK_CHANNEL_ID, text }, { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` }))
  }

  await Promise.all(jobs)
}

/* ------------------------------------------------------------------ 入口 */

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    ctx.waitUntil(
      runDailyAnalysis(env).catch((error) => {
        console.error('[daily-analysis] failed', error)
      }),
    )
  },

  /** 手动触发一次，便于部署后立刻验证 cron 逻辑 */
  async fetch(_request: Request, env: Env): Promise<Response> {
    const report = await runDailyAnalysis(env).catch(() => null)
    const body = report
      ? { ok: true, date: report.date, entries: report.entries.length }
      : { ok: false, reason: '非交易日或数据源不可用' }
    return new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json; charset=UTF-8' },
    })
  },
}
