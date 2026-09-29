<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useSeo } from '@/composables/useSeo'
import ActionDock from '@/components/ActionDock.vue'

const route = useRoute()
useSeo(route)
</script>
<template><a class="skip-link" href="#main">Skip to content</a><RouterView /><ActionDock v-if="!route.path.startsWith('/game')" /></template>
