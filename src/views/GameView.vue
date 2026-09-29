<script setup lang="ts">
import Navbar from '@/components/Navbar.vue'
import RunnerGame from '@/components/game/RunnerGame.vue'
</script>

<template>
  <Navbar />
  <main id="main" class="game-page">
    <div class="game-heading">
      <div>
        <p class="eyebrow">FAN / Playground</p>
        <h1>Game<span>.</span></h1>
      </div>
      <p>选一条路，向前跑。<br>能跑多远，由你决定。</p>
    </div>
    <RunnerGame />
  </main>
</template>

<style scoped>
.game-page { max-width: 1440px; min-height: 100svh; margin: 0 auto; padding: clamp(2rem, 5vw, 4.5rem) var(--gutter) 7rem; }
.game-heading { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 2rem; }
.game-heading h1 { margin: .85rem 0 0; font: 400 clamp(4.5rem, 10vw, 8rem)/.9 var(--display); letter-spacing: -.05em; }
.game-heading h1 span { color: #7aa628; }
.game-heading > p { margin: 0; color: var(--muted); font-size: .85rem; text-align: right; }
@media (max-width: 600px) { .game-heading { align-items: start; flex-direction: column; gap: .8rem; }.game-heading > p { text-align: left; } }
</style>
