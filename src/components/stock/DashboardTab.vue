<script setup lang="ts">
/**
 * Tab 1 —— 决策仪表盘
 * 顶部大盘概览 + 左侧自选股 + 右侧个股分析卡片
 */
import { computed } from 'vue'
import { AlertTriangle, Flame, RefreshCw, Trash2 } from 'lucide-vue-next'
import type { MarketSnapshot, StockQuote } from '@/services/marketApi'
import type { StockAnalysis } from '@/services/stockAnalysis'
import ScoreRing from './ScoreRing.vue'
import Sparkline from './Sparkline.vue'
import type { Candle } from '@/services/indicators'

const props = defineProps<{
  snapshot: MarketSnapshot | null
  quotes: StockQuote[]
  analyses: Array<StockAnalysis | null>
  candlesMap: Record<string, Candle[]>
  selectedCode: string
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (event: 'select', code: string): void
  (event: 'add', code: string): void
  (event: 'remove', code: string): void
  (event: 'refresh'): void
}>()

const newCode = defineModel<string>('newCode', { required: true })

const selectedAnalysis = computed(() => props.analyses.find((item) => item?.code === props.selectedCode) ?? null)
const selectedCandles = computed(() => props.candlesMap[props.selectedCode] ?? [])

const breadthMax = computed(() => {
  const { breadth } = props.snapshot ?? { breadth: null }
  if (!breadth) return 1
  return Math.max(breadth.up, breadth.down, breadth.flat, 1)
})

const breadthUpPct = computed(() => ((props.snapshot?.breadth.up ?? 0) / breadthMax.value) * 100)
const breadthDownPct = computed(() => ((props.snapshot?.breadth.down ?? 0) / breadthMax.value) * 100)

const sign = (value: number) => (value >= 0 ? `+${value}` : `${value}`)

function submitCode() {
  const code = newCode.value.trim()
  if (!code) return
  emit('add', code)
  newCode.value = ''
}
</script>

<template>
  <section>
    <div v-if="error" class="sw-note sw-note-warn">
      <b>行情获取失败：</b>{{ error }}。可能是数据源临时不可用或触发了限流，点击右上角「刷新」重试；下方仍会展示已缓存或上一次成功加载的内容。
    </div>

    <!-- 大盘概览 -->
    <div class="sw-overview">
      <div v-for="index in snapshot?.indices ?? []" :key="index.code" class="sw-index">
        <div class="sw-index-name">{{ index.name }}</div>
        <div class="sw-index-price" :class="index.changePct > 0 ? 'sw-up' : index.changePct < 0 ? 'sw-down' : 'sw-flat'">
          {{ index.price }}
        </div>
        <div class="sw-index-change" :class="index.changePct > 0 ? 'sw-up' : index.changePct < 0 ? 'sw-down' : 'sw-flat'">
          {{ sign(index.change) }} ({{ sign(index.changePct) }}%)
        </div>
      </div>
      <div v-if="!snapshot" class="sw-index"><div class="sw-skeleton" style="height: 22px; margin-bottom: 8px" /><div class="sw-skeleton" style="width: 60%" /></div>
    </div>

    <div class="sw-breadth">
      <div class="sw-breadth-item"><span>上涨</span><b class="sw-up">{{ snapshot?.breadth.up ?? '—' }}</b></div>
      <div class="sw-breadth-item"><span>下跌</span><b class="sw-down">{{ snapshot?.breadth.down ?? '—' }}</b></div>
      <div class="sw-breadth-item"><span>平盘</span><b>{{ snapshot?.breadth.flat ?? '—' }}</b></div>
      <div class="sw-breadth-item"><span>涨停</span><b class="sw-up">{{ snapshot?.breadth.limitUp ?? '—' }}</b></div>
      <div class="sw-breadth-item"><span>跌停</span><b class="sw-down">{{ snapshot?.breadth.limitDown ?? '—' }}</b></div>
      <div class="sw-breadth-bar" aria-hidden="true">
        <i :style="{ width: `${breadthUpPct}%`, background: 'var(--up)' }" />
        <i :style="{ width: `${breadthDownPct}%`, background: 'var(--down)' }" />
      </div>
      <div class="sw-breadth-item" style="margin-left: auto"><span>数据时间</span><b style="font-size: 13px">{{ snapshot?.updatedAt ?? '—' }}</b></div>
    </div>

    <div class="sw-dash">
      <!-- 自选股 -->
      <div class="sw-panel sw-watch">
        <div class="sw-panel-head">
          <h2>自选股</h2>
          <p>{{ quotes.length }} 只</p>
          <div class="sw-header-spacer" />
          <button class="sw-btn" type="button" :disabled="loading" @click="emit('refresh')">
            <RefreshCw :size="14" :class="{ 'sw-spin': loading }" />刷新
          </button>
        </div>

        <div class="sw-watch-list">
          <button
            v-for="(quote, index) in quotes"
            :key="quote.secid"
            class="sw-watch-row"
            type="button"
            :aria-current="quote.code === selectedCode"
            @click="emit('select', quote.code)"
          >
            <span class="sw-watch-name">{{ quote.name }}</span>
            <span class="sw-watch-price" :class="quote.changePct > 0 ? 'sw-up' : quote.changePct < 0 ? 'sw-down' : 'sw-flat'">{{ quote.price }}</span>
            <span class="sw-watch-code">{{ quote.code }} · {{ quote.market }}</span>
            <span class="sw-watch-pct" :class="quote.changePct > 0 ? 'sw-up' : quote.changePct < 0 ? 'sw-down' : 'sw-flat'">{{ sign(quote.changePct) }}%</span>
            <span class="sw-watch-score">
              <span class="sw-watch-score-track">
                <i
                  :style="{
                    width: `${analyses[index]?.score ?? 0}%`,
                    background: (analyses[index]?.score ?? 0) >= 62 ? 'var(--up)' : (analyses[index]?.score ?? 0) >= 45 ? 'var(--muted)' : 'var(--down)',
                  }"
                />
              </span>
              <b>{{ analyses[index] ? `${analyses[index]!.score} · ${analyses[index]!.rating}` : '计算中' }}</b>
            </span>
          </button>
        </div>

        <form class="sw-watch-form" @submit.prevent="submitCode">
          <input v-model="newCode" placeholder="添加代码，如 600519 / hk00700 / AAPL" aria-label="添加自选股代码" />
          <button class="sw-btn sw-btn-primary" type="submit">添加</button>
        </form>
        <p class="sw-watch-hint">
          支持 A 股（600519、sz000001）、港股（hk00700）、美股（AAPL）。列表保存在浏览器本地，不会上传。
        </p>
      </div>

      <!-- 分析卡片 -->
      <div class="sw-analysis">
        <div v-if="!selectedAnalysis" class="sw-panel"><div class="sw-empty">正在计算技术指标…</div></div>

        <template v-else>
          <div class="sw-panel">
            <div class="sw-panel-body">
              <div class="sw-analysis-hero">
                <div class="sw-analysis-id">
                  <h3>{{ selectedAnalysis.name }} <span style="font-size: 12px; color: var(--muted); font-weight: 500">{{ selectedAnalysis.code }} · {{ selectedAnalysis.market }}</span></h3>
                  <div class="sw-analysis-price" :class="selectedAnalysis.changePct > 0 ? 'sw-up' : selectedAnalysis.changePct < 0 ? 'sw-down' : 'sw-flat'">
                    {{ selectedAnalysis.price }}
                    <small :class="selectedAnalysis.changePct > 0 ? 'sw-up' : selectedAnalysis.changePct < 0 ? 'sw-down' : 'sw-flat'">
                      {{ sign(selectedAnalysis.changePct) }}%
                    </small>
                  </div>
                  <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap">
                    <span class="sw-rating" :data-rating="selectedAnalysis.rating">{{ selectedAnalysis.rating }}</span>
                    <span class="sw-trend">趋势：{{ selectedAnalysis.trend }}</span>
                  </div>
                </div>
                <ScoreRing :score="selectedAnalysis.score" />
              </div>

              <p class="sw-summary" style="margin-top: 16px">
                {{ selectedAnalysis.signals.slice().sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 3).map((s) => s.label).join(' · ') || '指标信号不足' }}
                ——综合评分由趋势、动量、量能、位置四维共 {{ selectedAnalysis.signals.length }} 项指标加权得出。
              </p>

              <Sparkline :candles="selectedCandles" />
              <p style="margin: 6px 0 0; font-size: 11.5px; color: var(--muted)">近 {{ selectedCandles.length }} 个交易日收盘价走势（数据截至 {{ selectedAnalysis.asOf || '最新交易日' }}）</p>
            </div>
          </div>

          <div class="sw-grid-2">
            <div class="sw-block">
              <h4><Flame :size="15" color="var(--up)" />利好催化</h4>
              <ul><li v-for="item in selectedAnalysis.catalysts" :key="item">{{ item }}</li></ul>
            </div>
            <div class="sw-block">
              <h4><AlertTriangle :size="15" color="var(--down)" />风险警报</h4>
              <ul><li v-for="item in selectedAnalysis.risks" :key="item">{{ item }}</li></ul>
            </div>
          </div>

          <div class="sw-panel">
            <div class="sw-panel-head"><h2>参考点位</h2><p>基于均线、布林带与 ATR 计算，非投资建议</p></div>
            <div class="sw-panel-body">
              <div class="sw-levels">
                <div class="sw-level"><span>参考支撑</span><b class="sw-down">{{ selectedAnalysis.reference.support ?? '—' }}</b></div>
                <div class="sw-level"><span>参考压力</span><b class="sw-up">{{ selectedAnalysis.reference.resistance ?? '—' }}</b></div>
                <div class="sw-level"><span>建议止损</span><b>{{ selectedAnalysis.reference.stopLoss ?? '—' }}</b></div>
                <div class="sw-level"><span>参考目标</span><b>{{ selectedAnalysis.reference.target ?? '—' }}</b></div>
              </div>
            </div>
          </div>

          <div class="sw-panel">
            <div class="sw-panel-head">
              <h2>操作检查清单</h2>
              <button class="sw-btn" type="button" @click="emit('remove', selectedAnalysis.code)">
                <Trash2 :size="14" />从自选股移除
              </button>
            </div>
            <div class="sw-panel-body">
              <div class="sw-block" style="background: transparent; border: 0; padding: 0">
                <ul><li v-for="item in selectedAnalysis.checklist" :key="item">{{ item }}</li></ul>
              </div>
            </div>
          </div>

          <div class="sw-panel">
            <div class="sw-panel-head"><h2>指标明细</h2><p>全部来自真实 K 线计算</p></div>
            <div class="sw-panel-body">
              <div class="sw-kpi">
                <div><span>MA5</span><b>{{ selectedAnalysis.indicators.ma5 ?? '—' }}</b></div>
                <div><span>MA10</span><b>{{ selectedAnalysis.indicators.ma10 ?? '—' }}</b></div>
                <div><span>MA20</span><b>{{ selectedAnalysis.indicators.ma20 ?? '—' }}</b></div>
                <div><span>MA60</span><b>{{ selectedAnalysis.indicators.ma60 ?? '—' }}</b></div>
                <div><span>RSI14</span><b>{{ selectedAnalysis.indicators.rsi14 ?? '—' }}</b></div>
                <div><span>MACD 柱</span><b>{{ selectedAnalysis.indicators.macd?.hist ?? '—' }}</b></div>
                <div><span>KDJ-K</span><b>{{ selectedAnalysis.indicators.kdj?.k ?? '—' }}</b></div>
                <div><span>KDJ-J</span><b>{{ selectedAnalysis.indicators.kdj?.j ?? '—' }}</b></div>
                <div><span>量比</span><b>{{ selectedAnalysis.indicators.volumeRatio5 ?? '—' }}</b></div>
                <div><span>ATR14</span><b>{{ selectedAnalysis.indicators.atr14 ?? '—' }}</b></div>
                <div><span>60日位置</span><b>{{ selectedAnalysis.indicators.rangePosition60 !== null ? `${Math.round(selectedAnalysis.indicators.rangePosition60 * 100)}%` : '—' }}</b></div>
                <div><span>60日波动率</span><b>{{ selectedAnalysis.indicators.volatility60d !== null ? `${selectedAnalysis.indicators.volatility60d}%` : '—' }}</b></div>
              </div>
            </div>
          </div>

          <div class="sw-panel">
            <div class="sw-panel-head"><h2>信号明细</h2><p>每项都标注了方向与权重</p></div>
            <div class="sw-panel-body" style="padding-top: 6px">
              <div v-for="signal in selectedAnalysis.signals" :key="signal.label" class="sw-signal" :data-kind="signal.kind">
                <i class="sw-signal-dot" />
                <b>{{ signal.label }}</b>
                <span>{{ signal.detail }}</span>
                <em>{{ signal.weight >= 0 ? `+${signal.weight}` : signal.weight }}</em>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <p class="sw-note" style="margin-top: 18px">
      <b>关于这份分析：</b>它由本地技术指标规则引擎生成，不是大模型输出。所有数值来自东方财富公开行情接口的真实 K 线，
      每一条结论都可以在上方「信号明细」里找到对应的指标依据。<b>不构成投资建议。</b>
    </p>
  </section>
</template>

<style scoped>
.sw-spin { animation: sw-rotate 1s linear infinite; }
@keyframes sw-rotate { to { transform: rotate(360deg); } }
</style>
