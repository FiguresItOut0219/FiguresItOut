<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import SectionHeading from './SectionHeading.vue'

const benefits = [
  ['White-label friendly', 'I can work quietly behind your agency brand.'],
  ['Design-conscious', 'I care about spacing, typography, motion and visual details — not just whether the page technically works.'],
  ['Fast communication', 'Clear updates and predictable delivery.'],
  ['Flexible capacity', 'Use me when projects overlap. No full-time commitment required.'],
  ['Clean handoff', 'Organized components and code your team can continue working with.'],
]
const sectionRef = useTemplateRef<HTMLElement>('benefitsSection')
const isRevealed = shallowRef(false)
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    isRevealed.value = true
    return
  }
  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      isRevealed.value = true
      observer?.disconnect()
    }
  }, { threshold: 0.2 })
  if (sectionRef.value) observer.observe(sectionRef.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section ref="benefitsSection" class="section benefits" :class="{ 'is-revealed': isRevealed }">
    <div class="benefits-heading">
      <SectionHeading eyebrow="Agency-first" title="A developer who stays behind the scenes." />
      <p aria-hidden="true">Quietly useful<br>visibly considered</p>
    </div>
    <div class="grid">
      <article v-for="(item, index) in benefits" :key="item[0]" :style="{ '--delay': `${index * 90}ms` }">
        <span class="number">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="card-line" aria-hidden="true"></span>
        <h3>{{ item[0] }}</h3>
        <p>{{ item[1] }}</p>
        <span class="corner" aria-hidden="true">↗</span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.benefits { overflow: hidden; background: var(--acid); }
.benefits-heading { position: relative; }
.benefits-heading > p { position: absolute; right: 0; bottom: 2.3rem; margin: 0; font: 500 1rem/1.05 var(--display); text-align: right; }
.grid { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid; }
.grid article { position: relative; min-height: 20rem; padding: 1.25rem; border-right: 1px solid; display: flex; flex-direction: column; opacity: 0; transform: translateY(1.75rem); transition: opacity .5s var(--ease) var(--delay), transform .5s var(--ease) var(--delay), background .25s ease; }
.is-revealed .grid article { opacity: 1; transform: none; }
.grid article:hover { background: #111; color: #f7f7f5; }
.number { font-size: .65rem; }
.card-line { width: 100%; height: 1px; margin-top: 1.3rem; background: currentColor; transform: scaleX(.15); transform-origin: left; transition: transform .35s var(--ease); }
.is-revealed .card-line { transform: scaleX(1); transition-delay: calc(var(--delay) + .2s); }
.grid article:hover .card-line { background: var(--acid); }
.grid h3 { font: 500 1.55rem var(--display); margin: auto 0 1rem; }
.grid p { font-size: .82rem; margin: 0; }
.corner { position: absolute; right: 1rem; top: 1rem; color: var(--acid); opacity: 0; transform: translate(-.4rem, .4rem); transition: opacity .2s ease, transform .2s ease; }
.grid article:hover .corner { opacity: 1; transform: none; }
@media (max-width: 900px) { .benefits-heading > p { display: none; }.grid { grid-template-columns: 1fr 1fr; }.grid article { min-height: 15rem; border-bottom: 1px solid; }.grid article:last-child { grid-column: 1 / -1; } }
@media (max-width: 500px) { .grid { grid-template-columns: 1fr; }.grid article:last-child { grid-column: auto; } }
@media (prefers-reduced-motion: reduce) { .grid article, .card-line { transition: none; }.grid article { opacity: 1; transform: none; }.card-line { transform: scaleX(1); } }
</style>
