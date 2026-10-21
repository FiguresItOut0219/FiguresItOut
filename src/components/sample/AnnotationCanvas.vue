<script setup lang="ts">
import { shallowRef } from 'vue'
import type { Part } from '@/services/sampleAnalysis'
const props = defineProps<{ image: string; dimensions: { width: number; height: number }; parts: Part[]; selected: number; relocating: boolean }>()
const emit = defineEmits<{ select: [index: number]; move: [index: number, kind: 'point' | 'label' | 'length', value: [number, number]] }>()
const svg = shallowRef<SVGSVGElement>()
let drag: { index: number; kind: 'label' | 'length'; start: [number, number]; point: [number, number]; label: [number, number] } | undefined
function coords(e: PointerEvent): [number, number] {
  const r = svg.value!.getBoundingClientRect()
  return [(e.clientX - r.left) / r.width * 1000, (e.clientY - r.top) / r.height * 1000]
}
function start(e: PointerEvent, index: number, kind: 'label' | 'length') {
  const p = props.parts[index]!
  drag = { index, kind, start: coords(e), point: [...p.point], label: [p.label[0], p.point[1]] }
  emit('select', index); svg.value?.setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (!drag || !svg.value) return
  const pos = coords(e)
  if (drag.kind === 'length') emit('move', drag.index, 'length', [drag.point[0] + pos[0] - drag.start[0], drag.point[1]])
  else emit('move', drag.index, 'label', [drag.label[0] + pos[0] - drag.start[0], drag.label[1] + pos[1] - drag.start[1]])
}
function place(e: PointerEvent) {
  if (!props.relocating || e.target !== svg.value || !svg.value) return
  const r = svg.value.getBoundingClientRect()
  emit('move', props.selected, 'point', [Math.max(0, Math.min(1000, (e.clientX - r.left) / r.width * 1000)), Math.max(0, Math.min(1000, (e.clientY - r.top) / r.height * 1000))])
}
function nudge(e: KeyboardEvent, index: number, kind: 'point' | 'label' | 'length') {
  const directions: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }
  const d = directions[e.key], p = props.parts[index]?.[kind === 'length' ? 'point' : kind]
  if (!d || !p) return
  e.preventDefault(); emit('select', index); emit('move', index, kind, [Math.max(20, Math.min(980, p[0] + d[0])), Math.max(20, Math.min(980, p[1] + d[1]))])
}
</script>
<template>
  <div class="sa-photo" :style="{ aspectRatio: `${dimensions.width} / ${dimensions.height}`, width: `min(100%, calc((var(--sa-board-height, 400px) - 24px) * ${dimensions.width / dimensions.height}))` }"><img :src="image" alt="待标注的样品原图" draggable="false"/><svg ref="svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" :class="{ 'sa-relocating': relocating }" @pointerdown="place" @pointermove="move" @pointerup="drag = undefined" @pointercancel="drag = undefined" @lostpointercapture="drag = undefined">
    <g v-for="(p, i) in parts" :key="i" :class="{ 'sa-selected': selected === i }">
      <line :x1="p.point[0]" :y1="p.point[1]" :x2="p.label[0]" :y2="p.point[1]" vector-effect="non-scaling-stroke"/><line class="sa-line-hit" :x1="p.point[0]" :y1="p.point[1]" :x2="p.label[0]" :y2="p.point[1]" vector-effect="non-scaling-stroke" @pointerdown.prevent.stop="start($event, i, 'length')"/>
      <circle :cx="p.point[0]" :cy="p.point[1]" r="8" tabindex="0" role="button" :aria-label="`调整部件 ${i + 1} 线条长短`" @keydown="nudge($event, i, 'length')" @pointerdown.prevent="start($event, i, 'length')"/>
      <g tabindex="0" role="button" :aria-label="`移动编号 ${i + 1}`" @keydown="nudge($event, i, 'label')" @pointerdown.prevent="start($event, i, 'label')"><ellipse :cx="p.label[0]" :cy="p.point[1]" rx="23" ry="23" fill="white"/><text :x="p.label[0]" :y="p.point[1]" dy=".35em" text-anchor="middle">{{ i + 1 }}</text></g>
    </g>
  </svg></div>
</template>





