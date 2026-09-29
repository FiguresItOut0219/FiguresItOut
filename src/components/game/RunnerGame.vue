<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { RunnerGame, type GameSnapshot } from '@/game/runner'

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const snapshot = shallowRef<GameSnapshot>({ phase: 'ready', score: 0, coins: 0, best: 0, speed: 19, elapsed: 0, lives: 3 })
const hitActive = ref(false)
const hitSequence = ref(0)
let game: RunnerGame | undefined
let observer: ResizeObserver | undefined
let hitTimer: ReturnType<typeof setTimeout> | undefined
let touchStart: { x: number; y: number; id: number } | undefined

function runTime(seconds: number) {
  const value = Math.floor(seconds)
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

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
  touchStart = { x: touch.clientX, y: touch.clientY, id: touch.identifier }
}

function onTouchMove(event: TouchEvent) {
  if (!touchStart) return
  const touch = Array.from(event.changedTouches).find(item => item.identifier === touchStart?.id)
  if (!touch) return
  const dx = touch.clientX - touchStart.x
  const dy = touch.clientY - touchStart.y
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
    game?.move(dx > 0 ? 1 : -1)
    touchStart.x = touch.clientX
    touchStart.y = touch.clientY
  } else if (dy < -42 && Math.abs(dy) > Math.abs(dx)) {
    game?.jump()
    touchStart.x = touch.clientX
    touchStart.y = touch.clientY
  }
}

function onTouchEnd(event: TouchEvent) {
  if (Array.from(event.changedTouches).some(item => item.identifier === touchStart?.id)) touchStart = undefined
}

function onVisibility() {
  if (document.hidden && snapshot.value.phase === 'running') game?.togglePause()
}

onMounted(() => {
  if (!canvas.value) return
  game = new RunnerGame(canvas.value, value => {
    if (value.lives < snapshot.value.lives) {
      hitSequence.value++
      hitActive.value = true
      clearTimeout(hitTimer)
      hitTimer = setTimeout(() => { hitActive.value = false }, 650)
    } else if (value.lives > snapshot.value.lives) {
      hitActive.value = false
      clearTimeout(hitTimer)
    }
    snapshot.value = value
  })
  observer = new ResizeObserver(() => game?.resize())
  observer.observe(canvas.value)
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  game?.destroy()
  observer?.disconnect()
  clearTimeout(hitTimer)
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <section class="runner" aria-label="跑酷游戏">
    <div class="runner-head">
      <RouterLink class="back-link" to="/game" aria-label="返回游戏列表"><span aria-hidden="true">←</span><span class="back-copy">游戏列表</span></RouterLink>
      <div class="runner-title"><span class="runner-marker" aria-hidden="true"></span><span>奶蛙 RUN</span><small>无限挑战</small></div>
      <button v-if="snapshot.phase === 'running' || snapshot.phase === 'paused'" class="pause-button" type="button" @click="game?.togglePause()">
        {{ snapshot.phase === 'paused' ? '继续' : '暂停' }}
      </button>
    </div>

    <div class="runner-stage" :class="{ 'is-hit': hitActive }" @touchstart.passive="onTouchStart" @touchmove.passive="onTouchMove" @touchend.passive="onTouchEnd" @touchcancel.passive="onTouchEnd">
      <canvas ref="canvas" class="runner-canvas" aria-label="奶蛙在三条跑道上跑酷的三维场景" />
      <div v-if="hitActive" :key="hitSequence" class="damage-fx" aria-hidden="true"><span>碰撞 −1</span></div>
      <div class="runner-hud" aria-live="off">
        <div><small>分数</small><strong>{{ snapshot.score.toLocaleString() }}</strong></div>
        <div><small>时长</small><strong>{{ runTime(snapshot.elapsed) }}</strong></div>
        <div><small>机会</small><strong>{{ snapshot.lives }}</strong></div>
        <div><small>金币</small><strong>{{ snapshot.coins }}</strong></div>
      </div>

      <div v-if="snapshot.phase !== 'running'" class="runner-overlay">
        <div class="overlay-content">
          <p class="overlay-kicker">{{ snapshot.phase === 'over' ? 'GAME OVER' : snapshot.phase === 'paused' ? 'ON HOLD' : 'READY, RUNNER?' }}</p>
          <h2>{{ snapshot.phase === 'over' ? '再来一局？' : snapshot.phase === 'paused' ? '暂停中' : '向前跑。' }}</h2>
          <p v-if="snapshot.phase === 'over'">坚持 {{ runTime(snapshot.elapsed) }} · 得分 {{ snapshot.score.toLocaleString() }} · 最高 {{ snapshot.best.toLocaleString() }}</p>
          <p v-else-if="snapshot.phase === 'ready'">三次机会。左右滑动换道，上滑跳跃。跳过矮栏杆，闪开高栏杆。</p>
          <p v-else>准备好就继续。</p>
          <button class="start-button" type="button" @click="snapshot.phase === 'paused' ? game?.togglePause() : game?.start()">
            {{ snapshot.phase === 'over' ? '重新开始' : snapshot.phase === 'paused' ? '继续游戏' : '开始游戏' }} <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </div>

    <div class="runner-footer">
      <p class="controls-hint"><span>键盘</span> ← → / A D 移动 · 空格 / ↑ 跳跃 · P 暂停</p>
      <p class="swipe-hint">左右滑动换道 · 上滑跳跃</p>
      <span class="game-speed">速度 {{ snapshot.speed }}</span>
    </div>
  </section>
</template>

<style scoped>
.runner { position: fixed; inset: 0; z-index: 10; display: flex; flex-direction: column; width: 100%; height: 100dvh; overflow: hidden; background: #111c22; color: #f3f6ef; font-family: var(--sans); }
.runner-head { flex: 0 0 auto; min-height: 61px; display: flex; align-items: center; gap: 1rem; padding: calc(.7rem + env(safe-area-inset-top)) max(1.35rem, env(safe-area-inset-right)) .7rem max(1.35rem, env(safe-area-inset-left)); border-bottom: 1px solid #34464a; }
.back-link { display: inline-flex; align-items: center; gap: .5rem; min-width: 44px; min-height: 44px; color: #e3ece8; font-size: .76rem; font-weight: 600; text-decoration: none; }
.back-link:hover { color: var(--acid); }
.back-link span:first-child { font-size: 1.2rem; }
.runner-title { display: flex; align-items: center; gap: .7rem; font-size: .86rem; font-weight: 700; letter-spacing: .13em; }
.runner-title { margin-right: auto; }
.runner-title small { margin-left: .8rem; color: #91a4a4; font-size: .61rem; font-weight: 600; letter-spacing: .14em; }
.runner-marker { width: .75rem; height: .75rem; background: var(--acid); transform: rotate(45deg); }
.pause-button { min-height: 44px; padding: .4rem .9rem; border: 1px solid #708581; background: transparent; color: #fff; }
.pause-button:hover { border-color: var(--acid); }
.runner-stage { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; touch-action: none; }
.runner-canvas { display: block; width: 100%; height: 100%; }
.damage-fx { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; pointer-events: none; background: radial-gradient(circle at 50% 60%, transparent 24%, #f34e3680 100%); box-shadow: inset 0 0 9rem #f34e3677; animation: damage-flash .65s ease-out forwards; }
.damage-fx span { padding: .5rem .85rem; border: 1px solid #ffd0b4; background: #a72f29e8; color: #fff5eb; font-size: .83rem; font-weight: 800; letter-spacing: .12em; animation: damage-label .65s ease-out forwards; }
.runner-stage.is-hit .runner-canvas { animation: damage-shake .4s ease-out; }
@keyframes damage-flash { 0% { opacity: 0; } 16% { opacity: 1; } 100% { opacity: 0; } }
@keyframes damage-label { 0% { opacity: 0; transform: translateY(.8rem) scale(.9); } 22% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-1.4rem); } }
@keyframes damage-shake { 0%, 100% { transform: translateX(0); } 16%, 48% { transform: translateX(-.35rem); } 32%, 64% { transform: translateX(.35rem); } }
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
.runner-footer { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 1rem; min-height: 68px; padding: .75rem max(1.2rem, env(safe-area-inset-right)) calc(.75rem + env(safe-area-inset-bottom)) max(1.2rem, env(safe-area-inset-left)); border-top: 1px solid #34464a; }
.controls-hint { margin: 0; color: #becfca; font-size: .74rem; }
.controls-hint span { margin-right: .8rem; color: var(--acid); font-weight: 700; }
.game-speed { flex-shrink: 0; color: #8fa6a1; font-size: .67rem; letter-spacing: .12em; }
.swipe-hint { display: none; margin: 0; color: #becfca; font-size: .74rem; }
@media (max-width: 850px) { .controls-hint { display: none; }.swipe-hint { display: block; } }
@media (max-width: 600px) { .runner-overlay { align-items: flex-start; padding-top: 5.2rem; background: linear-gradient(#0c151b55, transparent 65%); }.overlay-content { width: min(300px, 100%); } }
@media (max-width: 500px) { .runner-head { gap: .5rem; padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right)); }.back-copy, .runner-title small { display: none; }.runner-title { font-size: .78rem; }.runner-hud { gap: 1rem; }.runner-overlay { padding: 5.2rem .7rem .7rem; }.overlay-content { padding: .9rem 1rem; }.controls-hint { display: none; }.game-speed { font-size: .6rem; } }
</style>
