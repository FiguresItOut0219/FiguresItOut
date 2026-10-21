<script setup lang="ts">
// Adapted from Art Design Pro: src/components/core/cards/art-stats-card/index.vue (MIT).
import type { Component } from 'vue'
defineProps<{ title: string; count: number; description: string; icon: Component; tone?: string }>()
</script>
<template><div class="art-stats-card" :class="tone"><div class="art-stats-copy"><p>{{ title }}</p><strong>{{ count.toLocaleString() }}</strong><small>{{ description }}</small></div><span class="art-stats-icon"><component :is="icon" :size="22" :stroke-width="1.6"/></span></div></template>
