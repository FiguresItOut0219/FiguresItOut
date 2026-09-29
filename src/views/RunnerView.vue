<script setup lang="ts">
import RunnerGame from '@/components/game/RunnerGame.vue'
</script>

<template>
  <main id="main" class="game-screen">
    <RunnerGame />
  </main>
</template>

<style scoped>
.game-screen { width: 100%; height: 100dvh; overflow: hidden; background: #111c22; }
</style>
