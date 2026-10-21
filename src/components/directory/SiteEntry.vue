<script setup lang="ts">
import { ArrowUpRight, Calculator, Gamepad2, Layers3, Monitor, Printer, Utensils, Wrench } from 'lucide-vue-next'
import type { SiteEntry } from '@/data/sites'
defineProps<{ site: SiteEntry; featured?: boolean }>()
const icons = { print: Printer, calculator: Calculator, game: Gamepad2, portfolio: Monitor, restaurant: Utensils, studio: Layers3, service: Wrench }
</script>
<template>
  <RouterLink :to="site.path" class="site-entry" :class="[{ 'site-entry-featured': featured }, `site-${site.icon}`]">
    <span class="site-icon" aria-hidden="true"><component :is="icons[site.icon]" :size="featured ? 26 : 23" :stroke-width="1.5" /></span>
    <div class="site-copy"><span class="site-subtitle">{{ site.subtitle }}</span><h3>{{ site.name }}</h3><p>{{ site.description }}</p><div class="site-tags"><span v-for="tag in site.tags" :key="tag">{{ tag }}</span></div></div>
    <span class="site-open"><span>{{ featured ? '打开工具' : '进入网站' }}</span><ArrowUpRight :size="18" aria-hidden="true" /></span>
  </RouterLink>
</template>
