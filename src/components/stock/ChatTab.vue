<script setup lang="ts">
/**
 * Tab 3 —— 策略问股
 *
 * 两种模式：
 *   · 规则引擎（默认可用）：关键词路由 + 确定性策略筛选，全部基于真实指标，不调用大模型
 *   · AI 大模型（需服务端配 LLM_API_KEY）：走 /api/em/chat，密钥只在服务端，前端看不到
 *
 * 密钥探测用 GET /api/em/chat，只返回「有没有配」和模型名，绝不回传密钥本身。
 */
import { onMounted, ref } from 'vue'
import { Send, Sparkles, Trash2, Wrench } from 'lucide-vue-next'
import { STRATEGIES, answerQuestion, type AgentContext } from '@/services/stockAgent'
import { askLlm, fetchLlmStatus, type LlmHistoryItem, type LlmStatus, type MarketSnapshot } from '@/services/marketApi'
import type { StockAnalysis } from '@/services/stockAnalysis'

const props = defineProps<{
  snapshot: MarketSnapshot | null
  analyses: StockAnalysis[]
  ready: boolean
}>()

type Mode = 'rules' | 'ai'

interface Message {
  id: number
  role: 'user' | 'agent'
  text: string
  time: string
}

const messages = ref<Message[]>([])
const draft = ref('')
const log = ref<HTMLElement | null>(null)
const mode = ref<Mode>('rules')
const llmStatus = ref<LlmStatus | null>(null)
const streaming = ref(false)
let seq = 0

const now = () =>
  new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date())

onMounted(async () => {
  try {
    llmStatus.value = await fetchLlmStatus()
    if (llmStatus.value.configured) mode.value = 'ai'
  } catch {
    llmStatus.value = { configured: false, model: null }
  }
})

/** 喂给大模型的精简数据。只送结论层指标，不送整根 K 线，控制 token */
function buildContext() {
  return {
    数据时间: props.snapshot?.updatedAt ?? '',
    指数: (props.snapshot?.indices ?? []).map((item) => ({ 名称: item.name, 点位: item.price, 涨跌幅: item.changePct })),
    涨跌家数: props.snapshot?.breadth
      ? {
          上涨: props.snapshot.breadth.up,
          下跌: props.snapshot.breadth.down,
          平盘: props.snapshot.breadth.flat,
          涨停: props.snapshot.breadth.limitUp,
          跌停: props.snapshot.breadth.limitDown,
        }
      : null,
    领涨板块: (props.snapshot?.sectorsUp ?? []).slice(0, 5).map((item) => `${item.name} ${item.changePct}%`),
    领跌板块: (props.snapshot?.sectorsDown ?? []).slice(0, 5).map((item) => `${item.name} ${item.changePct}%`),
    自选股: props.analyses.map((item) => ({
      代码: item.code,
      名称: item.name,
      市场: item.market,
      现价: item.price,
      当日涨跌幅: item.changePct,
      评分: item.score,
      评级: item.rating,
      趋势: item.trend,
      RSI14: item.indicators.rsi14,
      MACD柱: item.indicators.macd?.hist ?? null,
      量比: item.indicators.volumeRatio5,
      MA20: item.indicators.ma20,
      MA60: item.indicators.ma60,
      '60日区间位置': item.indicators.rangePosition60,
      参考支撑: item.reference.support,
      参考压力: item.reference.resistance,
      建议止损: item.reference.stopLoss,
      利好催化: item.catalysts,
      风险警报: item.risks,
    })),
  }
}

function ruleContext(): AgentContext {
  return { snapshot: props.snapshot, analyses: props.analyses, quotes: [] }
}

async function scrollToEnd() {
  const { nextTick } = await import('vue')
  await nextTick()
  log.value?.scrollTo({ top: log.value.scrollHeight, behavior: 'smooth' })
}

async function send(text: string) {
  const question = text.trim()
  if (!question || streaming.value) return

  messages.value.push({ id: (seq += 1), role: 'user', text: question, time: now() })
  draft.value = ''
  await scrollToEnd()

  if (!props.ready && mode.value === 'rules') {
    messages.value.push({ id: (seq += 1), role: 'agent', text: '自选股数据还在加载中，请稍等片刻再提问。', time: now() })
    await scrollToEnd()
    return
  }

  if (mode.value === 'rules') {
    messages.value.push({ id: (seq += 1), role: 'agent', text: answerQuestion(question, ruleContext()), time: now() })
    await scrollToEnd()
    return
  }

  // AI 模式：流式填充同一条消息
  const placeholder: Message = { id: (seq += 1), role: 'agent', text: '', time: now() }
  messages.value.push(placeholder)
  streaming.value = true

  const history: LlmHistoryItem[] = messages.value
    .filter((item) => item.id !== placeholder.id && item.text)
    .slice(-6)
    .map((item) => ({ role: item.role === 'user' ? 'user' : 'assistant', content: item.text }))

  try {
    await askLlm({ question, history, data: buildContext() }, (delta) => {
      placeholder.text += delta
    })
  } catch (error) {
    placeholder.text = placeholder.text
      ? `${placeholder.text}\n\n（中途出错：${(error as Error).message}）`
      : `AI 问股失败：${(error as Error).message}。可以切换到「规则引擎」继续提问。`
  } finally {
    streaming.value = false
    await scrollToEnd()
  }
}
</script>

<template>
  <section class="sw-chat">
    <div class="sw-panel" style="overflow: hidden">
      <div class="sw-panel-head">
        <h2>策略问股</h2>
        <div class="sw-mode" role="group" aria-label="问答模式">
          <button type="button" :aria-pressed="mode === 'rules'" @click="mode = 'rules'">
            <Wrench :size="13" />规则引擎
          </button>
          <button
            type="button"
            :aria-pressed="mode === 'ai'"
            :disabled="!llmStatus?.configured"
            :title="llmStatus?.configured ? `使用 ${llmStatus.model}` : '服务端未配置 LLM_API_KEY'"
            @click="mode = 'ai'"
          >
            <Sparkles :size="13" />AI 大模型
          </button>
        </div>
        <div class="sw-header-spacer" />
        <span class="sw-mode-note">
          <template v-if="mode === 'ai'">模型 {{ llmStatus?.model }} · 密钥在服务端</template>
          <template v-else>本地规则引擎 · 不调用大模型</template>
        </span>
        <button v-if="messages.length" class="sw-btn" type="button" @click="messages = []"><Trash2 :size="14" />清空</button>
      </div>

      <div ref="log" class="sw-chat-log">
        <template v-if="!messages.length">
          <div class="sw-msg" data-role="agent">
            <template v-if="mode === 'rules'">
              我可以基于已加载的真实行情回答这几类问题：

              · 「大盘怎么样」—— 指数、涨跌家数、领涨领跌板块
              · 「排名」—— 按技术面综合评分排列自选股
              · 「风险」—— 当前触发的风险信号
              · 「贵州茅台」或「600519」—— 单只个股技术面
              · 直接点右侧策略名 —— 按该策略筛选自选股

              说明：规则引擎不做自然语言理解，所有数字都来自真实 K 线与指标计算。
            </template>
            <template v-else>
              已接入 AI 大模型。我会基于右侧提供的真实行情数据回答，不会编造数字；
              数据里没有的信息会直接说明。可以问「帮我对比一下自选股的风险」、
              「用大白话解释茅台现在的技术面」这类开放问题。

              结尾会附上免责声明。
            </template>
          </div>
        </template>
        <div v-for="message in messages" :key="message.id" class="sw-msg" :data-role="message.role">
          {{ message.text }}<span v-if="streaming && message.role === 'agent' && !message.text" class="sw-typing">正在思考</span>
          <span class="sw-msg-time">{{ message.time }}</span>
        </div>
      </div>

      <form class="sw-chat-form" @submit.prevent="send(draft)">
        <input v-model="draft" :placeholder="mode === 'ai' ? '向 AI 提问，基于已加载的行情数据…' : '输入问题，如「大盘怎么样」「排名」「600519」'" aria-label="输入问题" :disabled="streaming" />
        <button class="sw-btn sw-btn-primary" type="submit" :disabled="!draft.trim() || streaming">
          <Send :size="14" />{{ streaming ? '生成中' : '发送' }}
        </button>
      </form>
    </div>

    <aside class="sw-panel">
      <div class="sw-panel-head"><h2>内置策略</h2></div>
      <div class="sw-panel-body">
        <button v-for="strategy in STRATEGIES" :key="strategy.id" class="sw-strategy" type="button" :disabled="streaming" @click="send(strategy.name)">
          <b>{{ strategy.name }}</b>
          <small>{{ strategy.description }}</small>
        </button>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.sw-mode { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.sw-mode button {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px; border: 0; background: var(--panel-2);
  font-size: 12px; color: var(--muted);
}
.sw-mode button + button { border-left: 1px solid var(--line); }
.sw-mode button[aria-pressed='true'] { background: var(--accent); color: #fff; }
.sw-mode button:disabled { opacity: .4; cursor: default; }
.sw-mode-note { font-size: 11.5px; color: var(--muted); }
.sw-typing::after { content: '…'; animation: sw-blink 1.2s steps(4) infinite; }
@keyframes sw-blink { 50% { opacity: .25; } }
</style>
