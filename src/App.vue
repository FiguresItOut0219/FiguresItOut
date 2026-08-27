<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useSeo } from '@/composables/useSeo'

useSeo(useRoute())
</script>
<template><a class="skip-link" href="#main">Skip to content</a><RouterView /></template>
