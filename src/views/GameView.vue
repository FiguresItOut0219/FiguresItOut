<script setup lang="ts">
import Navbar from '@/components/Navbar.vue'
</script>

<template>
  <Navbar />
  <main id="main" class="game-page">
    <div class="game-heading">
      <div>
        <p class="eyebrow">FAN / Playground</p>
        <h1>Game<span>.</span></h1>
      </div>
      <p>一点休息时间，来玩一局。</p>
    </div>
    <section class="game-list" aria-label="游戏列表">
      <RouterLink class="game-entry" to="/game/runner">
        <div class="entry-art" aria-hidden="true">
          <span class="lane lane-left"></span>
          <span class="lane lane-right"></span>
          <span class="runner-shape"></span>
        </div>
        <div class="entry-copy">
          <span class="eyebrow">01 / 3D 跑酷</span>
          <h2>奶蛙跑酷</h2>
          <p>三次机会，在越来越快的栏杆跑道上挑战更长时间。</p>
          <span class="entry-action">进入游戏 <span aria-hidden="true">↗</span></span>
        </div>
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.game-page { max-width: 1440px; min-height: 100svh; margin: 0 auto; padding: clamp(2rem, 5vw, 4.5rem) var(--gutter) 7rem; }
.game-heading { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 2rem; }
.game-heading h1 { margin: .85rem 0 0; font: 400 clamp(4.5rem, 10vw, 8rem)/.9 var(--display); letter-spacing: -.05em; }
.game-heading h1 span { color: #7aa628; }
.game-heading > p { margin: 0; color: var(--muted); font-size: .85rem; text-align: right; }
.game-list { border-top: 1px solid var(--line); }
.game-entry { display: grid; grid-template-columns: minmax(220px, 38%) 1fr; min-height: 310px; border-bottom: 1px solid var(--line); color: var(--ink); text-decoration: none; }
.game-entry:hover .entry-action { background: var(--acid); }
.game-entry:hover .entry-art { filter: brightness(1.14); }
.entry-art { position: relative; min-height: 310px; overflow: hidden; background: #152831; transition: filter .2s ease; }
.entry-art::before { content: ''; position: absolute; inset: 25% 15% -25%; background: #2c4545; clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%); }
.entry-art::after { content: ''; position: absolute; inset: 25% 15% -25%; border-bottom: 4px solid var(--acid); clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%); }
.lane { position: absolute; z-index: 1; top: 32%; bottom: -8%; width: 2px; background: #b6c9b8; transform-origin: top; }
.lane-left { left: 47%; transform: rotate(14deg); }.lane-right { right: 47%; transform: rotate(-14deg); }
.runner-shape { position: absolute; z-index: 2; left: calc(50% - 23px); bottom: 15%; width: 46px; height: 76px; border-radius: 46% 46% 40% 40%; background: #efc45b; box-shadow: 0 12px 0 -5px #6d6846; }
.entry-copy { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: clamp(2rem, 5vw, 5rem); }
.entry-copy h2 { margin: 1.25rem 0 .5rem; font: 400 clamp(2.6rem, 5vw, 4.8rem)/1 var(--display); }
.entry-copy p { margin: 0 0 2rem; color: var(--muted); font-size: .9rem; }
.entry-action { display: inline-flex; align-items: center; justify-content: space-between; gap: 2rem; min-height: 48px; padding: .6rem 1rem; border: 1px solid var(--ink); font-size: .8rem; font-weight: 700; transition: background .2s ease; }
@media (max-width: 600px) { .game-heading { align-items: start; flex-direction: column; gap: .8rem; }.game-heading > p { text-align: left; }.game-entry { grid-template-columns: 1fr; }.entry-art { min-height: 160px; }.entry-copy { padding: 1.4rem 0 2rem; }.entry-copy p { margin-bottom: 1.2rem; } }
</style>
