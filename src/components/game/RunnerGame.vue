<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import { RunnerGame, type GameSnapshot } from '@/game/runner'

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const snapshot = shallowRef<GameSnapshot>({ phase: 'ready', score: 0, coins: 0, best: 0, speed: 14 })
let game: RunnerGame | undefined
let observer: ResizeObserver | undefined
let touchStart: { x: number; y: number } | undefined

function onKey(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (['arrowleft', 'arrowright', 'arrowup', ' ', 'a', 'd', 'w', 'p', 'escape'].includes(key)) event.preventDefault()
  if (key === 'arrowleft' || key === 'a') game?.move(-1)
  if (key === 'arrowright' || key === 'd') game?.move(1)
  if (key === 'arrowup' || key === 'w' || key === ' ') game?.jump()
  if (key === 'p' || key === 'escape') game?.togglePause()
  if (key === 'enter' && (snapshot.value.phase === 'ready' || snapshot.value.phase === 'over')) game?.start()
}

function onTouchStart(event: TouchEvent) {
  const touch = event.changedTouches[0]
  touchStart = { x: touch.clientX, y: touch.clientY }
}

function onTouchEnd(event: TouchEvent) {
  if (!touchStart) return
  const touch = event.changedTouches[0]
  const dx = touch.clientX - touchStart.x
  const dy = touch.clientY - touchStart.y
  if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) game?.move(dx > 0 ? 1 : -1)
  else if (dy < -35 || (Math.abs(dx) < 20 && Math.abs(dy) < 20)) game?.jump()
  touchStart = undefined
}

function onVisibility() {
  if (document.hidden && snapshot.value.phase === 'running') game?.togglePause()
}

onMounted(() => {
  if (!canvas.value) return
  game = new RunnerGame(canvas.value, value => { snapshot.value = value })
  observer = new ResizeObserver(() => game?.resize())
  observer.observe(canvas.value)
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  game?.destroy()
  observer?.disconnect()
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <section class="runner" aria-label="跑酷游戏">
    <div class="runner-head">
      <div class="runner-title"><span class="runner-marker" aria-hidden="true"></span><span>奶蛙 RUN</span><small>01 / ENDLESS</small></div>
      <button v-if="snapshot.phase === 'running' || snapshot.phase === 'paused'" class="pause-button" type="button" @click="game?.togglePause()">
        {{ snapshot.phase === 'paused' ? '继续' : '暂停' }}
      </button>
    </div>

    <div class="runner-stage" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
      <canvas ref="canvas" class="runner-canvas" aria-label="奶蛙在三条跑道上跑酷的三维场景" />
      <div class="runner-hud" aria-live="off">
        <div><small>分数</small><strong>{{ snapshot.score.toLocaleString() }}</strong></div>
        <div><small>金币</small><strong>{{ snapshot.coins }}</strong></div>
        <div><small>最高</small><strong>{{ snapshot.best.toLocaleString() }}</strong></div>
      </div>

      <div v-if="snapshot.phase !== 'running'" class="runner-overlay">
        <div class="overlay-content">
          <p class="overlay-kicker">{{ snapshot.phase === 'over' ? 'RUN COMPLETE' : snapshot.phase === 'paused' ? 'ON HOLD' : 'READY, RUNNER?' }}</p>
          <h2>{{ snapshot.phase === 'over' ? '再来一局？' : snapshot.phase === 'paused' ? '暂停中' : '向前跑。' }}</h2>
          <p v-if="snapshot.phase === 'over'">本局得分 {{ snapshot.score.toLocaleString() }} · 收集 {{ snapshot.coins }} 枚金币</p>
          <p v-else-if="snapshot.phase === 'ready'">左右移动，跳过矮箱，避开高墙，收集金币。</p>
          <p v-else>准备好就继续。</p>
          <button class="start-button" type="button" @click="snapshot.phase === 'paused' ? game?.togglePause() : game?.start()">
            {{ snapshot.phase === 'over' ? '重新开始' : snapshot.phase === 'paused' ? '继续游戏' : '开始游戏' }} <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </div>

    <div class="runner-footer">
      <p class="controls-hint"><span>键盘</span> ← → / A D 移动 · 空格 / ↑ 跳跃 · P 暂停</p>
      <div class="touch-controls" aria-label="游戏操作">
        <button type="button" aria-label="向左移动" @click="game?.move(-1)">←</button>
        <button type="button" aria-label="跳跃" @click="game?.jump()">跳跃</button>
        <button type="button" aria-label="向右移动" @click="game?.move(1)">→</button>
      </div>
      <span class="game-speed">速度 {{ snapshot.speed }}</span>
    </div>
  </section>
</template>

<style scoped>
.runner { overflow: hidden; border: 1px solid #2e3c3e; background: #111c22; color: #f3f6ef; font-family: var(--sans); }
.runner-head { min-height: 61px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .7rem 1.35rem; border-bottom: 1px solid #34464a; }
.runner-title { display: flex; align-items: center; gap: .7rem; font-size: .86rem; font-weight: 700; letter-spacing: .13em; }
.runner-title small { margin-left: .8rem; color: #91a4a4; font-size: .61rem; font-weight: 600; letter-spacing: .14em; }
.runner-marker { width: .75rem; height: .75rem; background: var(--acid); transform: rotate(45deg); }
.pause-button { min-height: 38px; padding: .4rem .9rem; border: 1px solid #708581; background: transparent; color: #fff; }
.pause-button:hover { border-color: var(--acid); }
.runner-stage { position: relative; height: clamp(410px, 62vw, 620px); touch-action: none; }
.runner-canvas { display: block; width: 100%; height: 100%; }
.runner-hud { position: absolute; top: 1rem; left: 1.2rem; right: 1.2rem; display: flex; gap: clamp(1.2rem, 4vw, 3.5rem); pointer-events: none; }
.runner-hud div { display: grid; gap: .25rem; min-width: 55px; }
.runner-hud small { color: #c4d3d0; font-size: .63rem; font-weight: 700; letter-spacing: .11em; }
.runner-hud strong { font-size: clamp(1.05rem, 3vw, 1.55rem); font-variant-numeric: tabular-nums; }
.runner-overlay { position: absolute; inset: 0; display: flex; align-items: end; padding: 1.5rem; background: linear-gradient(transparent 55%, #0c151b66); pointer-events: none; }
.overlay-content { width: min(340px, 100%); padding: 1.2rem 1.3rem; border: 1px solid #526966; background: #102027ef; pointer-events: auto; }
.overlay-kicker { margin: 0; color: var(--acid); font-size: .68rem; font-weight: 700; letter-spacing: .2em; }
.overlay-content h2 { margin: .65rem 0; color: #fff; font: 400 clamp(2.2rem, 5vw, 3.1rem)/1 var(--display); }
.overlay-content p:not(.overlay-kicker) { color: #d2ded9; font-size: .9rem; }
.start-button { display: inline-flex; justify-content: space-between; align-items: center; gap: 2rem; min-height: 50px; margin-top: 1rem; padding: .65rem 1.15rem; border: 1px solid var(--acid); background: var(--acid); color: #121c16; font-weight: 700; }
.start-button:hover { background: #e3ff9a; }
.runner-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 68px; padding: .75rem 1.2rem; border-top: 1px solid #34464a; }
.controls-hint { margin: 0; color: #becfca; font-size: .74rem; }
.controls-hint span { margin-right: .8rem; color: var(--acid); font-weight: 700; }
.game-speed { flex-shrink: 0; color: #8fa6a1; font-size: .67rem; letter-spacing: .12em; }
.touch-controls { display: flex; gap: .6rem; }
.touch-controls button { min-width: 54px; min-height: 46px; padding: .5rem; border: 1px solid #738884; background: #26373b; color: #fff; font-weight: 700; }
.touch-controls button:hover { border-color: var(--acid); }
@media (min-width: 851px) { .touch-controls { display: none; } }
@media (max-width: 850px) { .runner-footer { flex-wrap: wrap; }.controls-hint { width: 100%; }.game-speed { margin-left: auto; } }
@media (max-width: 500px) { .runner-stage { height: 470px; }.runner-title small { display: none; }.runner-hud { gap: 1rem; }.runner-overlay { padding: .7rem; }.overlay-content { padding: .9rem 1rem; }.controls-hint { display: none; }.runner-footer { padding: .75rem; }.game-speed { font-size: .6rem; } }
</style>
