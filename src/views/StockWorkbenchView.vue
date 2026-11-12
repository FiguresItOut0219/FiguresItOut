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
  DEFAULT_WATCHLIST,
  fetchCandles,
  fetchMarketSnapshot,
  fetchQuotes,
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
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.filter((item): item is string => typeof item === 'string').slice(0, 20)
      }
    }
  } catch {
    /* 本地存储不可用时退回默认列表 */
  }
  return [...DEFAULT_WATCHLIST]
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
const selectedCode = ref('')

const loading = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const autoRefresh = ref(false)
let timer: number | undefined

const sourceState = computed<'live' | 'stale' | 'error'>(() => {
  if (error.value && !snapshot.value && !quotes.value.length) return 'error'
  if (error.value) return 'stale'
  return 'live'
})

const sourceLabel = computed(() => {
  if (sourceState.value === 'error') return '数据源不可用'
  if (sourceState.value === 'stale') return '部分数据不可用'
  return snapshot.value ? `实时 · ${snapshot.value.updatedAt}` : '加载中'
})

const ready = computed(() => analyses.value.some((item) => item !== null))

/* ------------------------------------------------------------------ 数据加载 */

async function loadAll() {
  loading.value = true
  error.value = null
  try {
    const market = await fetchMarketSnapshot()
    snapshot.value = market

    const quoteList = await fetchQuotes(watchlist.value)
    quotes.value = quoteList
    if (!quoteList.some((item) => item.code === selectedCode.value)) selectedCode.value = quoteList[0]?.code ?? ''

    const results = await Promise.all(
      quoteList.map(async (quote) => {
        try {
          const candles = await fetchCandles(quote.secid, 120)
          candlesMap.value = { ...candlesMap.value, [quote.secid]: candles }
          return candles.length >= 20 ? analyseStock(quote, candles) : null
        } catch {
          return null
        }
      }),
    )
    analyses.value = results

    const failed = results.filter((item) => item === null).length
    if (failed) notice.value = `${failed} 只股票的 K 线数据获取失败，已跳过其技术分析`
  } catch (fetchError) {
    error.value = fetchError instanceof Error ? fetchError.message : '未知错误'
  } finally {
    loading.value = false
  }
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
  saveWatchlist(watchlist.value)
  notice.value = null
  loadAll()
}

function removeCode(code: string) {
  watchlist.value = watchlist.value.filter((item) => item !== code)
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

      <DashboardTab
        v-if="activeTab === 'dashboard'"
        v-model:new-code="newCode"
        :snapshot="snapshot"
        :quotes="quotes"
        :analyses="analyses"
        :candles-map="candlesMap"
        :selected-code="selectedCode"
        :loading="loading"
        :error="error"
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
