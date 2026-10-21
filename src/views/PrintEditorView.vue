<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
import PrintStudio from '@/components/print/PrintStudio.vue'
</script>
<template><PrintStudio :key="String(route.query.order || 'standalone')" /></template>
