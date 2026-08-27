<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import SectionHeading from './SectionHeading.vue'

const steps = [
  ['Send the design', 'Figma, reference site or existing layout.'],
  ['I build', 'Responsive frontend, interactions and implementation.'],
  ['Review', 'You review the staging link and send feedback.'],
  ['Deliver', 'Production-ready code or deployed website.'],
]
const processRef = useTemplateRef<HTMLElement>('process')
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
  }, { threshold: 0.22 })
  if (processRef.value) observer.observe(processRef.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section id="process" ref="process" class="section process" :class="{ 'is-revealed': isRevealed }">
    <div class="process-heading">
      <SectionHeading eyebrow="The process" title="Built to fit into your workflow." />
      <p class="process-index" aria-hidden="true">01—04 <span>Project rhythm</span></p>
    </div>
    <ol class="steps">
      <li v-for="(step, index) in steps" :key="step[0]" :style="{ '--delay': `${index * 110}ms` }">
        <span class="step-number">0{{ index + 1 }}</span>
        <span class="step-marker" aria-hidden="true"></span>
        <h3>{{ step[0] }}</h3>
        <p>{{ step[1] }}</p>
        <span class="step-action" aria-hidden="true">→</span>
      </li>
    </ol>
    <p class="note">Clear communication. <i>No unnecessary meetings.</i> No surprises.</p>
  </section>
</template>

<style scoped>
.process { overflow: hidden; background: #f4f4f0; }
.process-heading { position: relative; }
.process-index { position: absolute; right: 0; bottom: 2.2rem; color: var(--muted); font: 600 .64rem/1 var(--sans); letter-spacing: .1em; text-transform: uppercase; }
.process-index span { display: block; margin-top: .7rem; color: #111; }
.steps { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); padding: 0; list-style: none; border-top: 1px solid; }
.steps::before { content: ''; position: absolute; top: -1px; left: 0; width: 100%; height: 2px; background: var(--acid); transform: scaleX(0); transform-origin: left; transition: transform .9s var(--ease); }
.is-revealed .steps::before { transform: scaleX(1); }
.steps li { position: relative; min-height: 23rem; padding: 1.5rem 2rem 3.5rem 0; border-right: 1px solid var(--line); opacity: 0; transform: translateY(2rem); transition: opacity .55s var(--ease) var(--delay), transform .55s var(--ease) var(--delay); }
.is-revealed .steps li { opacity: 1; transform: none; }
.steps li + li { padding-left: 2rem; }
.steps li:nth-child(2) { background: #ebebe5; }
.steps li:nth-child(3) { background: #f0f0eb; }
.step-number { display: block; color: #4b4b47; font: 700 .68rem var(--sans); letter-spacing: .08em; }
.step-marker { display: block; width: 9px; height: 9px; margin: 1.8rem 0 auto; border-radius: 50%; background: #9b9b94; box-shadow: 0 0 0 4px #deded7; }
.steps li:nth-child(2) .step-marker { background: #8dad12; box-shadow: 0 0 0 4px #dcecb1; }
.steps h3 { max-width: 11ch; margin: 4.3rem 0 1.1rem; font: 500 clamp(2rem, 2.45vw, 2.85rem)/.94 var(--display); letter-spacing: -.035em; }
.steps p { max-width: 18rem; margin: 0; color: #4e4e49; font-size: .95rem; line-height: 1.55; }
.step-action { position: absolute; right: 1.3rem; bottom: 1.2rem; color: #171714; font-size: 1.25rem; }
.note { font: 500 clamp(2rem, 4vw, 4.8rem)/1 var(--display); letter-spacing: -.04em; margin: 6rem 0 0; opacity: 0; transform: translateY(1rem); transition: opacity .6s var(--ease) .4s, transform .6s var(--ease) .4s; }
.is-revealed .note { opacity: 1; transform: none; }
.note i { font-weight: 400; }
@media (max-width: 800px) { .process-index { display: none; }.steps { grid-template-columns: 1fr 1fr; }.steps li { min-height: 17rem; border-bottom: 1px solid; padding: 1.5rem 1rem 2.5rem 0; }.steps li + li { padding-left: 1rem; }.steps h3 { margin-top: 3rem; }.note { margin-top: 5rem; } }
@media (max-width: 500px) { .steps { grid-template-columns: 1fr; }.steps li { min-height: 14rem; }.steps li + li { padding-left: 0; }.steps h3 { margin-top: 2.5rem; } }
@media (prefers-reduced-motion: reduce) { .steps::before, .steps li, .note { transition: none; }.steps::before { transform: scaleX(1); }.steps li, .note { opacity: 1; transform: none; } }
</style>
