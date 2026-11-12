<script setup lang="ts">
/**
 * 股票智能分析工作台 —— /tools/stock-workbench
 *
 * 对应 daily_stock_analysis 的 Web 工作台，但完全跑在 Cloudflare Worker 上：
 *   · 页面只请求同源 /api/em/*，由 Worker 代理东方财富并加 CORS 头与缓存
 *   · 定时分析由 Worker 的 Cron Trigger 完成，结果写入 KV，可推送到 IM
 *   · 「AI 分析」由本地技术指标规则引擎产生，不调用大模型
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { LineChart, RefreshCw } from 'lucide-vue-next'
import '@/components/stock/stock.css'
import {
  fetchBreadth,
  fetchCandles,
  fetchIndices,
  fetchQuotes,
  fetchSectors,
  formatBeijingTime,
  resolveCode,
  type MarketSnapshot,
  type StockQuote,
} from '@/services/marketApi'
import { analyseStock, type StockAnalysis } from '@/services/stockAnalysis'
import type { Candle } from '@/services/indicators'
import DashboardTab from '@/components/stock/DashboardTab.vue'
import ReviewTab from '@/components/stock/ReviewTab.vue'
import ChatTab from '@/components/stock/ChatTab.vue'

const STORAGE_KEY = 'fan:stock-workbench:watchlist'
const TABS = [
  { id: 'dashboard', label: '决策仪表盘' },
  { id: 'review', label: '大盘复盘' },
  { id: 'agent', label: '策略问股' },
] as const

type TabId = (typeof TABS)[number]['id']

/* ------------------------------------------------------------------ 自选股 */

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const codes = parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => resolveCode(item)?.display)
          .filter((code): code is string => code !== undefined)
        return [...new Set(codes)].slice(0, 20)
      }
    }
  } catch {
    /* 本地存储不可用时从空列表开始 */
  }
  return []
}

function saveWatchlist(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* 忽略写入失败 */
  }
}

/* ------------------------------------------------------------------ 状态 */

const activeTab = ref<TabId>('dashboard')
const watchlist = ref<string[]>(loadWatchlist())
const newCode = ref('')

const snapshot = ref<MarketSnapshot | null>(null)
const quotes = ref<StockQuote[]>([])
const analyses = ref<Array<StockAnalysis | null>>([])
const candlesMap = ref<Record<string, Candle[]>>({})
const selectedCode = ref(watchlist.value[0] ?? '')

const loading = ref(false)
const stocksLoading = ref(false)
const failures = ref<string[]>([])
const error = computed(() => failures.value.length ? failures.value.join('；') : null)
const notice = ref<string | null>(null)
const autoRefresh = ref(false)
let timer: number | undefined
let activeRequest: AbortController | undefined

const sourceState = computed<'live' | 'stale' | 'error'>(() => {
  if (error.value && !loading.value && !snapshot.value && !quotes.value.length) return 'error'
  if (error.value) return 'stale'
  return 'live'
})

const sourceLabel = computed(() => {
  if (sourceState.value === 'error') return '数据源不可用'
  if (sourceState.value === 'stale') return '部分数据不可用'
  if (snapshot.value) return `最近更新 · ${snapshot.value.updatedAt}`
  return quotes.value.length ? '自选行情已加载' : '加载中'
})

const ready = computed(() => analyses.value.some((item) => item !== null))

/* ------------------------------------------------------------------ 数据加载 */

function updateMarket(data: Partial<MarketSnapshot>) {
  snapshot.value = {
    indices: [],
    sectorsUp: [],
    sectorsDown: [],
    breadth: null,
    ...snapshot.value,
    ...data,
    updatedAt: formatBeijingTime(new Date()),
  }
}

async function loadStocks(signal: AbortSignal) {
  const requestedCodes = watchlist.value
  const quoteList = await fetchQuotes(requestedCodes, signal)
  if (signal.aborted) return
  if (requestedCodes.length && !quoteList.length) throw new Error('数据源未返回行情')

  quotes.value = quoteList
  analyses.value = []
  candlesMap.value = {}

  const results = await Promise.all(quoteList.map(async (quote) => {
    try {
      const candles = await fetchCandles(quote.secid, 120, signal)
      return { code: quote.code, candles, analysis: candles.length >= 20 ? analyseStock(quote, candles) : null }
    } catch {
      return { code: quote.code, candles: [], analysis: null }
    }
  }))
  if (signal.aborted) return

  candlesMap.value = Object.fromEntries(results.map(({ code, candles }) => [code, candles]))
  analyses.value = results.map(({ analysis }) => analysis)
  const failed = results.filter(({ analysis }) => analysis === null).length
  if (failed) failures.value.push(`${failed} 只自选股的 K 线不足，暂无法计算指标`)
}

async function loadAll() {
  activeRequest?.abort()
  activeRequest = new AbortController()
  const { signal } = activeRequest
  loading.value = true
  stocksLoading.value = true
  failures.value = []

  async function load<T>(label: string, request: Promise<T>, apply?: (data: T) => void) {
    try {
      const data = await request
      if (!signal.aborted) apply?.(data)
    } catch (cause) {
      if (!signal.aborted) failures.value.push(`${label}：${cause instanceof Error ? cause.message : '请求失败'}`)
    }
  }

  await Promise.all([
    load('指数', fetchIndices(signal), (indices) => {
      if (!indices.length) throw new Error('数据源未返回行情')
      updateMarket({ indices })
    }),
    load('领涨板块', fetchSectors('up', 8, signal), (sectorsUp) => updateMarket({ sectorsUp })),
    load('领跌板块', fetchSectors('down', 8, signal), (sectorsDown) => updateMarket({ sectorsDown })),
    load('涨跌家数', fetchBreadth(signal), (breadth) => updateMarket({ breadth })),
    load('自选股行情', loadStocks(signal)).finally(() => {
      if (!signal.aborted) stocksLoading.value = false
    }),
  ])
  if (!signal.aborted) loading.value = false
}

function addCode(raw: string) {
  const resolved = resolveCode(raw)
  if (!resolved) {
    notice.value = `无法识别代码「${raw}」，支持 600519 / sz000001 / hk00700 / AAPL`
    return
  }
  if (watchlist.value.includes(resolved.display)) {
    notice.value = `${resolved.display} 已在自选股中`
    return
  }
  watchlist.value = [...watchlist.value, resolved.display]
  if (!selectedCode.value) selectedCode.value = resolved.display
  saveWatchlist(watchlist.value)
  notice.value = null
  loadAll()
}

function removeCode(code: string) {
  watchlist.value = watchlist.value.filter((item) => item !== code)
  quotes.value = quotes.value.filter((item) => item.code !== code)
  analyses.value = analyses.value.filter((item) => item?.code !== code)
  delete candlesMap.value[code]
  if (selectedCode.value === code) selectedCode.value = watchlist.value[0] ?? ''
  saveWatchlist(watchlist.value)
  notice.value = null
  loadAll()
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (timer) window.clearInterval(timer)
  if (autoRefresh.value) timer = window.setInterval(loadAll, 60_000)
}

onMounted(loadAll)
onBeforeUnmount(() => {
  activeRequest?.abort()
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="sw-app">
    <header class="sw-header">
      <div class="sw-brand">
        <LineChart :size="22" />
        <div>股票智能分析<small>Stock Workbench</small></div>
      </div>

      <span class="sw-source" :data-state="sourceState">
        <i class="sw-source-dot" />数据源 <b>{{ sourceLabel }}</b>
      </span>

      <div class="sw-header-spacer" />

      <button class="sw-btn" type="button" :aria-pressed="autoRefresh" @click="toggleAutoRefresh">
        {{ autoRefresh ? '停止自动刷新' : '自动刷新 60s' }}
      </button>
      <button class="sw-btn sw-btn-primary" type="button" :disabled="loading" @click="loadAll">
        <RefreshCw :size="14" :class="{ 'sw-spin': loading }" />刷新
      </button>
    </header>

    <nav class="sw-tabs" role="tablist" aria-label="工作台分区">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="sw-tab"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <main class="sw-main">
      <p v-if="notice" class="sw-note sw-note-warn" style="margin-bottom: 16px">{{ notice }}</p>
      <p v-if="error" class="sw-note sw-note-warn" role="status">{{ error }}。可刷新重试。</p>

      <DashboardTab
        v-if="activeTab === 'dashboard'"
        v-model:new-code="newCode"
        :snapshot="snapshot"
        :watchlist="watchlist"
        :quotes="quotes"
        :analyses="analyses"
        :candles-map="candlesMap"
        :selected-code="selectedCode"
        :loading="loading"
        :stocks-loading="stocksLoading"
        @select="selectedCode = $event"
        @add="addCode"
        @remove="removeCode"
        @refresh="loadAll"
      />
      <ReviewTab v-else-if="activeTab === 'review'" :snapshot="snapshot" :loading="loading" />
      <ChatTab v-else :snapshot="snapshot" :analyses="analyses.filter((item): item is StockAnalysis => item !== null)" :ready="ready" />
    </main>

    <footer class="sw-footer">
      <b>数据来源：</b>东方财富公开行情接口，经同域 Cloudflare Worker 代理并提供 30~60 秒缓存。<br />
      <b>分析方式：</b>本地技术指标规则引擎（MA / RSI / MACD / KDJ / BOLL / ATR / 量比），完全确定性，不调用大模型。<br />
      <b>免责声明：</b>本页面仅供学习研究与技术演示，所有评分、点位与信号均为指标计算结果，不构成任何投资建议。股市有风险，投资需谨慎。
    </footer>
  </div>
</template>

<style scoped>
.sw-spin { animation: sw-rotate 1s linear infinite; }
@keyframes sw-rotate { to { transform: rotate(360deg); } }
</style>
