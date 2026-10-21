<script setup lang="ts">
// Reduced from Art Design Pro's art-table-header; removes theme, column drag and fullscreen settings.
import { RefreshCw } from 'lucide-vue-next'
defineProps<{ title: string; count: number; loading?: boolean }>()
defineEmits<{ refresh: [] }>()
</script>
<template><div class="art-table-header"><div><h2>{{ title }}<span>{{ count }}</span></h2><slot name="description"/></div><div class="art-table-actions"><slot/><button class="company-icon-button" aria-label="刷新列表" :disabled="loading" @click="$emit('refresh')"><RefreshCw :size="16" :class="{spinning:loading}"/></button></div></div></template>
