import * as THREE from 'three'
import { createMilkFrog, type MilkFrog } from './milkFrog'

export type GamePhase = 'ready' | 'running' | 'paused' | 'over'

export interface GameSnapshot {
  phase: GamePhase
  score: number
  coins: number
  best: number
  speed: number
  elapsed: number
  lives: number
  flightRemaining: number
}

type Item = { lane: number; z: number; type: 'lowRail' | 'highRail' | 'coin' | 'airCoin' | 'jetpack'; mesh: THREE.Group; resolved?: boolean }

const LANES = [-2.45, 0, 2.45]
const PLAYER_Z = 2
const SPAWN_Z = -82
const BEST_KEY = 'fan-runner-best'
const MAX_DIFFICULTY_AT = 75
const START_SPEED = 27
const MAX_SPEED = 46
const FLIGHT_DURATION = 5

function bestScore() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0 } catch { return 0 }
}

function saveBest(value: number) {
  try { localStorage.setItem(BEST_KEY, String(value)) } catch { /* Storage may be unavailable. */ }
}

export class RunnerGame {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(55, 1, .1, 180)
  private frog: MilkFrog
  private jetpackRig = new THREE.Group()
  private laneMarks: THREE.Mesh[] = []
  private posts: THREE.Group[] = []
  private onChange: (snapshot: GameSnapshot) => void
  private frame = 0
  private lastTime = 0
  private lastReport = 0
  private phase: GamePhase = 'ready'
  private lane = 1
  private lanePosition = 0
  private jumpHeight = 0
  private jumpVelocity = 0
  private distance = 0
  private score = 0
  private coins = 0
  private best = bestScore()
  private speed = START_SPEED
  private elapsed = 0
  private lives = 3
  private hitCooldown = 0
  private flightRemaining = 0
  private flightHeight = 0
  private nextJetpackAt = 30 + Math.random() * 15
  private nextSpawn = 14
  private items: Item[] = []

  constructor(canvas: HTMLCanvasElement, onChange: (snapshot: GameSnapshot) => void) {
    this.onChange = onChange
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.35
    this.scene.background = new THREE.Color(0x172b35)
    this.scene.fog = new THREE.Fog(0x172b35, 35, 125)

    const ambient = new THREE.HemisphereLight(0xbfdce3, 0x59634a, 2.2)
    this.scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffe4ae, 3)
    sun.position.set(-7, 14, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -14
    sun.shadow.camera.right = 14
    sun.shadow.camera.top = 15
    sun.shadow.camera.bottom = -15
    this.scene.add(sun)

    this.buildWorld()
    this.frog = createMilkFrog()
    this.frog.root.position.z = PLAYER_Z
    this.buildJetpack()
    this.scene.add(this.frog.root)
    this.resize()
    this.report()
    this.frame = requestAnimationFrame(this.tick)
  }

  private box(parent: THREE.Object3D, width: number, height: number, depth: number, color: number, x: number, y: number, z: number, shadow = false) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: .84 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  private buildWorld() {
    this.box(this.scene, 9.4, .16, 180, 0x263e3f, 0, -.13, -56)
    this.box(this.scene, 12.8, .12, 180, 0x17292e, 0, -.25, -56)
    for (const side of [-1, 1]) {
      this.box(this.scene, .08, .045, 180, 0xc8ff3d, side * 4.53, .005, -56)
      this.box(this.scene, .28, .25, 180, 0x10252a, side * 4.85, -.03, -56)
    }

    for (const x of [-1.23, 1.23]) {
      for (let i = 0; i < 19; i++) {
        const mark = this.box(this.scene, .085, .018, 3.1, 0xacc9b7, x, -.03, 8 - i * 6)
        this.laneMarks.push(mark)
      }
    }

    for (let i = 0; i < 16; i++) {
      const group = new THREE.Group()
      group.position.z = 6 - i * 8
      for (const side of [-1, 1]) {
        this.box(group, .2, 1.15, .2, 0xc8ff3d, side * 5.15, .58, 0)
        this.box(group, .35, .12, .36, 0x152b2c, side * 5.15, .07, 0)
      }
      this.scene.add(group)
      this.posts.push(group)
    }

    // Low-poly buildings frame the view without covering the lanes.
    for (let i = 0; i < 15; i++) {
      const z = -i * 9 - 9
      for (const side of [-1, 1]) {
        const height = 5 + ((i * 7) % 9)
        const width = 3.5 + (i % 3)
        this.box(this.scene, width, height, 5, i % 2 ? 0x223b45 : 0x1c323c, side * (8.5 + (i % 3) * 1.5), height / 2 - .15, z)
        this.box(this.scene, .8, .18, .06, 0x93a75c, side * (8.5 + (i % 3) * 1.5), height * .63, z + 2.54)
      }
    }
  }

  private buildJetpack() {
    const rig = this.jetpackRig
    rig.position.set(0, 1.55, -.68)
    this.box(rig, .55, .7, .2, 0x5de3ec, 0, 0, 0, true)
    for (const side of [-1, 1]) {
      this.box(rig, .24, .55, .27, 0xd8f7e9, side * .37, -.04, -.02, true)
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(.13, .55, 10),
        new THREE.MeshBasicMaterial({ color: 0xffc559 }),
      )
      flame.rotation.z = Math.PI
      flame.position.set(side * .37, -.6, -.02)
      rig.add(flame)
    }
    rig.visible = false
    this.frog.root.add(rig)
  }

  resize() {
    const canvas = this.renderer.domElement
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.position.set(0, width < 600 ? 4.2 : 4.4, width < 600 ? 13.5 : 11.5)
    this.camera.lookAt(0, 1.25, -14)
    this.camera.updateProjectionMatrix()
    this.frog.root.scale.setScalar(width < 600 ? .83 : .74)
    this.render()
  }

  start() {
    for (const item of this.items) this.removeItem(item)
    this.items = []
    this.phase = 'running'
    this.lane = 1
    this.lanePosition = 0
    this.jumpHeight = 0
    this.jumpVelocity = 0
    this.distance = 0
    this.score = 0
    this.coins = 0
    this.speed = START_SPEED
    this.elapsed = 0
    this.lives = 3
    this.hitCooldown = 0
    this.flightRemaining = 0
    this.flightHeight = 0
    this.nextJetpackAt = 30 + Math.random() * 15
    this.nextSpawn = 14
    this.frog.root.visible = true
    this.jetpackRig.visible = false
    this.lastTime = 0
    this.report()
  }

  togglePause() {
    if (this.phase === 'running') this.phase = 'paused'
    else if (this.phase === 'paused') { this.phase = 'running'; this.lastTime = 0 }
    this.report()
  }

  move(direction: -1 | 1) {
    if (this.phase !== 'running') return
    this.lane = Math.max(0, Math.min(2, this.lane + direction))
  }

  jump() {
    if (this.phase !== 'running' || this.jumpHeight > 0 || this.flightRemaining > 0) return
    this.jumpVelocity = 8.5
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) material.dispose()
    })
    this.renderer.dispose()
  }

  private report() {
    this.onChange({ phase: this.phase, score: this.score, coins: this.coins, best: this.best, speed: Math.round(this.speed), elapsed: this.elapsed, lives: this.lives, flightRemaining: this.flightRemaining })
  }

  private makeItem(lane: number, z: number, type: Item['type']): Item {
    const group = new THREE.Group()
    group.position.set(LANES[lane], 0, z)
    if (type === 'lowRail') {
      for (const x of [-.83, .83]) this.box(group, .18, 1.15, .22, 0xe1774a, x, .58, 0, true)
      this.box(group, 1.85, .24, .26, 0xffbd81, 0, 1.03, 0, true)
      this.box(group, 1.85, .12, .28, 0xe1774a, 0, .72, 0)
    } else if (type === 'highRail') {
      for (const x of [-.83, .83]) this.box(group, .2, 2.65, .24, 0xb94e45, x, 1.33, 0, true)
      for (const y of [.72, 1.5, 2.35]) this.box(group, 1.9, .2, .28, 0xffa577, 0, y, 0, true)
    } else if (type === 'jetpack') {
      const glow = new THREE.MeshStandardMaterial({ color: 0x64eafa, emissive: 0x2389b1, emissiveIntensity: .9, metalness: .45, roughness: .3 })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.65, .09, 10, 24), glow)
      ring.position.y = 1.35
      group.add(ring)
      this.box(group, .58, .7, .34, 0x8af6ee, 0, 1.35, 0, true)
      for (const x of [-.4, .4]) this.box(group, .2, .56, .3, 0xffd176, x, 1.3, 0, true)
    } else {
      const material = new THREE.MeshStandardMaterial({ color: 0xffd568, metalness: .58, roughness: .26, emissive: 0x684400, emissiveIntensity: .35 })
      const coin = new THREE.Mesh(new THREE.TorusGeometry(.43, .12, 8, 18), material)
      coin.position.y = type === 'airCoin' ? 0 : 1.45
      if (type === 'airCoin') group.position.y = 4.8
      group.add(coin)
    }
    this.scene.add(group)
    return { lane, z, type, mesh: group }
  }

  private removeItem(item: Item) {
    item.mesh.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) material.dispose()
    })
    this.scene.remove(item.mesh)
  }

  private tick = (time: number) => {
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, .05) : 0
    this.lastTime = time
    if (this.phase === 'running') this.update(dt)
    this.frog.root.visible = this.phase !== 'running' || this.hitCooldown <= 0 || Math.floor(time / 90) % 2 === 0
    this.frog.animate(this.distance, this.jumpHeight + this.flightHeight, LANES[this.lane] - this.lanePosition, this.phase === 'running')
    const baseCameraY = this.renderer.domElement.clientWidth < 600 ? 4.2 : 4.4
    this.camera.position.y += (baseCameraY + Math.min(1.2, this.flightHeight * .36) - this.camera.position.y) * .1
    this.camera.lookAt(0, 1.25 + this.flightHeight * .34, -14)
    this.render()
    if (time - this.lastReport > 150) { this.report(); this.lastReport = time }
    this.frame = requestAnimationFrame(this.tick)
  }

  private update(dt: number) {
    this.elapsed += dt
    this.hitCooldown = Math.max(0, this.hitCooldown - dt)
    if (this.flightRemaining > 0) {
      this.flightRemaining = Math.max(0, this.flightRemaining - dt)
      if (this.flightRemaining === 0) this.hitCooldown = Math.max(this.hitCooldown, 1.2)
    }
    this.flightHeight += ((this.flightRemaining > 0 ? 3.25 : 0) - this.flightHeight) * Math.min(1, dt * 4.5)
    this.jetpackRig.visible = this.flightRemaining > 0 || this.flightHeight > .3
    const difficulty = Math.min(1, this.elapsed / MAX_DIFFICULTY_AT)
    this.speed = START_SPEED + (MAX_SPEED - START_SPEED) * difficulty
    const step = this.speed * dt
    this.distance += step
    this.score = Math.floor(this.distance * 3) + this.coins * 25
    this.lanePosition += (LANES[this.lane] - this.lanePosition) * Math.min(1, dt * 12)
    this.frog.root.position.x = this.lanePosition

    if (this.jumpVelocity || this.jumpHeight) {
      this.jumpHeight = Math.max(0, this.jumpHeight + this.jumpVelocity * dt)
      this.jumpVelocity -= 19 * dt
      if (this.jumpHeight === 0) this.jumpVelocity = 0
    }

    for (const mark of this.laneMarks) {
      mark.position.z += step
      if (mark.position.z > 10) mark.position.z -= 114
    }
    for (const post of this.posts) {
      post.position.z += step
      if (post.position.z > 10) post.position.z -= 128
    }

    this.nextSpawn -= step
    if (this.nextSpawn <= 0) {
      const safeLane = Math.floor(Math.random() * 3)
      const blockedLanes = [0, 1, 2].filter(lane => lane !== safeLane)
      const barrierCount = Math.random() < difficulty * .45 ? 2 : 1
      for (let i = 0; i < barrierCount; i++) {
        const lane = blockedLanes.splice(Math.floor(Math.random() * blockedLanes.length), 1)[0]!
        const type = Math.random() < .72 - difficulty * .18 ? 'lowRail' : 'highRail'
        this.items.push(this.makeItem(lane, SPAWN_Z, type))
      }
      if (this.elapsed >= this.nextJetpackAt) {
        this.items.push(this.makeItem(safeLane, SPAWN_Z - 5, 'jetpack'))
        this.nextJetpackAt = this.elapsed + 55 + Math.random() * 25
      } else if (Math.random() < .7) {
        this.items.push(this.makeItem(safeLane, SPAWN_Z - 5, 'coin'))
      }
      const interval = 1.5 - difficulty * .65 + Math.random() * .2
      this.nextSpawn += this.speed * interval
    }

    for (const item of this.items) {
      item.z += step
      item.mesh.position.z = item.z
      if (item.type === 'coin' || item.type === 'airCoin' || item.type === 'jetpack') item.mesh.rotation.y += dt * 2.5
      if (item.resolved || item.z < PLAYER_Z - .7 || item.z > PLAYER_Z + .7 || item.lane !== this.lane) continue
      item.resolved = true
      if (item.type === 'coin') { if (this.flightHeight < 1) this.coins++; continue }
      if (item.type === 'airCoin') { if (this.flightRemaining > 0 && this.flightHeight > 1) this.coins++; continue }
      if (item.type === 'jetpack') {
        this.flightRemaining = FLIGHT_DURATION
        this.jumpHeight = 0
        this.jumpVelocity = 0
        this.hitCooldown = 0
        for (let i = 0; i < 7; i++) {
          this.items.push(this.makeItem(this.lane, PLAYER_Z - this.speed * (.7 + i * .55), 'airCoin'))
        }
        this.report()
        continue
      }
      if (this.flightRemaining > 0 || this.flightHeight > 1) continue
      if ((item.type === 'highRail' || this.jumpHeight < 1.05) && this.hitCooldown <= 0) {
        this.lives--
        this.hitCooldown = 1.25
        if (this.lives <= 0) {
          this.phase = 'over'
          this.frog.root.visible = true
          if (this.score > this.best) { this.best = this.score; saveBest(this.best) }
        }
        this.report()
      }
    }
    this.items = this.items.filter(item => {
      // Passed barriers remain in the scene until they move behind the runner.
      if (item.z <= PLAYER_Z + 7 && !((item.type === 'coin' || item.type === 'airCoin' || item.type === 'jetpack') && item.resolved)) return true
      this.removeItem(item)
      return false
    })
  }

  private render() { this.renderer.render(this.scene, this.camera) }
}
