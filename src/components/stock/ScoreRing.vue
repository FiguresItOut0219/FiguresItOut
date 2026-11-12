<script setup lang="ts">
/**
 * 股票工作台的共用小组件。
 * 全部是纯展示，不自己发请求。
 */
import { computed } from 'vue'

/* ------------------------------------------------------------------ 评分环 */

const props = defineProps<{ score: number; size?: number }>()

const radius = computed(() => (props.size ?? 92) / 2 - 7)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() => circumference.value * (1 - Math.max(0, Math.min(100, props.score)) / 100))

const ringColor = computed(() => {
  if (props.score >= 78) return 'var(--up)'
  if (props.score >= 62) return '#f4738a'
  if (props.score >= 45) return 'var(--muted)'
  if (props.score >= 30) return '#35c99b'
  return 'var(--down)'
})
</script>

<template>
  <div class="sw-score-ring" :style="{ width: `${size ?? 92}px`, height: `${size ?? 92}px` }">
    <svg :width="size ?? 92" :height="size ?? 92" aria-hidden="true">
      <circle :cx="(size ?? 92) / 2" :cy="(size ?? 92) / 2" :r="radius" fill="none" stroke="var(--panel-2)" stroke-width="7" />
      <circle
        :cx="(size ?? 92) / 2"
        :cy="(size ?? 92) / 2"
        :r="radius"
        fill="none"
        :stroke="ringColor"
        stroke-width="7"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
      />
    </svg>
    <div class="sw-score-ring-label">
      <b>{{ score }}</b>
      <span>技术评分</span>
    </div>
  </div>
</template>
