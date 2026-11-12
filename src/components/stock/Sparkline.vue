<script setup lang="ts">
/** 迷你走势图：用真实 K 线收盘价画，不上采样、不插值 */
import { computed } from 'vue'
import type { Candle } from '@/services/indicators'

const props = defineProps<{ candles: Candle[]; height?: number }>()

const points = computed(() => {
  const closes = props.candles.map((candle) => candle.close).filter((value) => value > 0)
  if (closes.length < 2) return ''
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = max - min || 1
  const width = 300
  const height = props.height ?? 56
  return closes
    .map((close, index) => {
      const x = (index / (closes.length - 1)) * width
      const y = height - 4 - ((close - min) / span) * (height - 8)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const rising = computed(() => {
  const closes = props.candles.map((candle) => candle.close)
  return closes.length >= 2 && closes[closes.length - 1] >= closes[0]
})
</script>

<template>
  <svg v-if="points" class="sw-spark" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
    <polyline :points="points" fill="none" :stroke="rising ? 'var(--up)' : 'var(--down)'" stroke-width="1.8" vector-effect="non-scaling-stroke" />
  </svg>
  <div v-else class="sw-empty" style="padding: 16px 0">K 线数据不足，无法绘制走势</div>
</template>
