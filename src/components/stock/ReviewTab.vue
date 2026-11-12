<script setup lang="ts">
/** Tab 2 —— 大盘复盘：指数、涨跌分布、领涨领跌板块 */
import { computed } from 'vue'
import { TrendingDown, TrendingUp } from 'lucide-vue-next'
import type { MarketSnapshot } from '@/services/marketApi'

const props = defineProps<{ snapshot: MarketSnapshot | null; loading: boolean }>()

const sign = (value: number) => (value >= 0 ? `+${value}` : `${value}`)

const distMax = computed(() => Math.max(...(props.snapshot?.breadth?.distribution.map((item) => item.count) ?? []), 1))

const label = (bucket: number) => {
  if (bucket === 11) return '涨停'
  if (bucket === -11) return '跌停'
  if (bucket === 10) return '≥10%'
  if (bucket === -10) return '≤-10%'
  if (bucket > 0) return `+${bucket}%`
  if (bucket < 0) return `${bucket}%`
  return '平盘'
}

const bucketColor = (bucket: number) => {
  if (bucket >= 9) return 'var(--up)'
  if (bucket > 0) return '#f0435a80'
  if (bucket <= -9) return 'var(--down)'
  if (bucket < 0) return '#14b88680'
  return 'var(--muted)'
}
</script>

<template>
  <section>
    <div v-if="!snapshot" class="sw-panel"><div class="sw-empty">{{ loading ? '正在加载大盘数据…' : '大盘数据暂不可用' }}</div></div>

    <template v-else>
      <div class="sw-review-grid">
        <div style="display: flex; flex-direction: column; gap: 18px">
          <div class="sw-panel">
            <div class="sw-panel-head"><h2>主要指数</h2></div>
            <div class="sw-panel-body" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px">
              <div v-for="index in snapshot.indices" :key="index.code" class="sw-block" style="padding: 13px 15px">
                <div class="sw-index-name">{{ index.name }}</div>
                <div class="sw-index-price" :class="index.changePct > 0 ? 'sw-up' : index.changePct < 0 ? 'sw-down' : 'sw-flat'">{{ index.price }}</div>
                <div class="sw-index-change" :class="index.changePct > 0 ? 'sw-up' : index.changePct < 0 ? 'sw-down' : 'sw-flat'">{{ sign(index.change) }} ({{ sign(index.changePct) }}%)</div>
              </div>
              <div v-if="!snapshot.indices.length" class="sw-empty">{{ loading ? '正在加载指数…' : '指数暂不可用' }}</div>
            </div>
          </div>

          <div class="sw-panel">
            <div class="sw-panel-head">
              <h2>涨跌分布</h2>
              <p v-if="snapshot.breadth">上涨 {{ snapshot.breadth.up }} · 下跌 {{ snapshot.breadth.down }} · 平盘 {{ snapshot.breadth.flat }}</p>
            </div>
            <div class="sw-panel-body">
              <div v-if="!snapshot.breadth?.distribution.length" class="sw-empty">{{ loading && !snapshot.breadth ? '正在加载涨跌分布…' : '分布数据暂不可用' }}</div>
              <div v-else class="sw-dist">
                <div v-for="item in snapshot.breadth.distribution" :key="item.bucket" class="sw-dist-row">
                  <span>{{ label(item.bucket) }}</span>
                  <div class="sw-dist-track">
                    <i :style="{ width: `${(item.count / distMax) * 100}%`, background: bucketColor(item.bucket) }" />
                  </div>
                  <b :class="item.bucket > 0 ? 'sw-up' : item.bucket < 0 ? 'sw-down' : ''">{{ item.count }}</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 18px">
          <div class="sw-panel">
            <div class="sw-panel-head"><h2><TrendingUp :size="16" color="var(--up)" /> 领涨板块</h2></div>
            <div class="sw-panel-body" style="padding-top: 6px">
              <div v-for="(sector, index) in snapshot.sectorsUp" :key="sector.name" class="sw-sector-row">
                <span class="sw-sector-rank">{{ index + 1 }}</span>
                <span class="sw-sector-name">
                  <b>{{ sector.name }}</b>
                  <small v-if="sector.leader">领涨股 {{ sector.leader }}{{ sector.leaderChangePct ? ` ${sign(sector.leaderChangePct)}%` : '' }}<template v-if="sector.upCount"> · 板块内上涨 {{ sector.upCount }} 家</template></small>
                </span>
                <span class="sw-sector-pct sw-up">{{ sign(sector.changePct) }}%</span>
              </div>
              <div v-if="!snapshot.sectorsUp.length" class="sw-empty">{{ loading ? '正在加载领涨板块…' : '领涨板块暂不可用' }}</div>
            </div>
          </div>

          <div class="sw-panel">
            <div class="sw-panel-head"><h2><TrendingDown :size="16" color="var(--down)" /> 领跌板块</h2></div>
            <div class="sw-panel-body" style="padding-top: 6px">
              <div v-for="(sector, index) in snapshot.sectorsDown" :key="sector.name" class="sw-sector-row">
                <span class="sw-sector-rank">{{ index + 1 }}</span>
                <span class="sw-sector-name">
                  <b>{{ sector.name }}</b>
                  <small v-if="sector.leader">领跌股 {{ sector.leader }}{{ sector.leaderChangePct ? ` ${sign(sector.leaderChangePct)}%` : '' }}</small>
                </span>
                <span class="sw-sector-pct sw-down">{{ sector.changePct }}%</span>
              </div>
              <div v-if="!snapshot.sectorsDown.length" class="sw-empty">{{ loading ? '正在加载领跌板块…' : '领跌板块暂不可用' }}</div>
            </div>
          </div>
        </div>
      </div>

      <p class="sw-note" style="margin-top: 18px">
        <b>数据说明：</b>涨跌分布覆盖沪深京全部 A 股，涨停/跌停家数取自东方财富涨停跌停池；
        板块涨跌按行业板块（东财二级行业）计算。以上为客观行情统计，不含任何观点，<b>不构成投资建议</b>。
      </p>
    </template>
  </section>
</template>
