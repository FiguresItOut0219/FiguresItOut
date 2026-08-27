<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const action = computed(() => {
  if (route.path === '/work/luma') return { href: '#reserve', label: 'Reserve a table', detail: 'Reservations' }
  if (route.path === '/work/summit') return { href: '#quote', label: 'Get a free quote', detail: 'Same-day availability' }
  if (route.path === '/work/northstar') return { href: '#contact', label: 'Start a project', detail: 'Tell us your brief' }
  return { href: '#contact', label: 'Start a project', detail: 'Available for selected work' }
})
</script>

<template>
  <a class="action-dock" :class="`action-dock--${route.path.split('/').at(-1) || 'home'}`" :href="action.href">
    <span class="action-dot" aria-hidden="true"></span>
    <span class="action-copy"><small>{{ action.detail }}</small><b>{{ action.label }}</b></span>
    <span class="action-arrow" aria-hidden="true">↗</span>
  </a>
</template>

<style scoped>
.action-dock { --dock-bg: #111; --dock-ink: #f7f7f5; --dock-accent: var(--acid); position: fixed; z-index: 50; right: clamp(1rem, 2.5vw, 2.5rem); bottom: clamp(1rem, 2.5vw, 2.5rem); min-width: 228px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .7rem; padding: .82rem .95rem; border: 1px solid var(--dock-bg); background: var(--dock-bg); color: var(--dock-ink); box-shadow: 0 8px 24px #00000024; text-decoration: none; transition: transform .2s var(--ease), box-shadow .2s ease, background .2s ease; }
.action-dock:hover { transform: translateY(-3px); box-shadow: 0 14px 28px #00000038; }
.action-dock:focus-visible { outline: 3px solid var(--dock-accent); outline-offset: 4px; }
.action-dock--luma { --dock-bg: #c5b79d; --dock-ink: #171714; --dock-accent: #fff; }
.action-dock--summit { --dock-bg: #f26032; --dock-ink: #fff; --dock-accent: #102b3f; }
.action-dock--northstar { --dock-bg: #2948ff; --dock-ink: #fff; --dock-accent: #d6ff4b; }
.action-dot { width: .55rem; height: .55rem; border-radius: 50%; background: var(--dock-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--dock-accent) 20%, transparent); }
.action-copy { display: grid; gap: .18rem; }
.action-copy small { font: 600 .57rem/1 var(--sans, Arial, sans-serif); letter-spacing: .08em; text-transform: uppercase; opacity: .78; }
.action-copy b { font: 700 .76rem/1.1 var(--sans, Arial, sans-serif); }
.action-arrow { font-size: 1rem; transition: transform .2s ease; }
.action-dock:hover .action-arrow { transform: translate(2px, -2px); }
@media (max-width: 600px) { .action-dock { right: 1rem; bottom: 1rem; min-width: 0; padding: .75rem .8rem; }.action-copy small { display: none; } }
@media (prefers-reduced-motion: reduce) { .action-dock, .action-arrow { transition: none; } }
</style>
