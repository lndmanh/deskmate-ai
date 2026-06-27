<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */
const ICON_INDEXES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'] as const

const ICON_ROOT = 'https://qclay.design/lovable/loader'
const darkSrc = (n: string): string => `${ICON_ROOT}/icon-${n}.svg`
const whiteSrc = (n: string): string => `${ICON_ROOT}/icon-w-${n}.svg`

const M_POLY = '/polygons/m-polygon.svg'
const S_POLY = '/polygons/s-polygon.svg'
const C_POLY = '/polygons/c-polygon.svg'

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */
const HEX_W = 141
const HEX_H = 155
const GAP = 8
const STEP_X = HEX_W + GAP // 149
const STEP_Y = HEX_H * 0.78 + GAP // 128.9

type Variant = 's' | 'c' | 'm'
interface Hex {
  x: number
  y: number
  variant: Variant
  z: number
  iconSet?: 'dark' | 'white'
  slot?: number
}

const SRC_BY_VARIANT: Record<Variant, string> = {
  m: M_POLY,
  s: S_POLY,
  c: C_POLY
}

const HEXES: Hex[] = [
  // Outer ring (z 0)
  { x: -2 * STEP_X, y: -2 * STEP_Y, variant: 's', z: 0 },
  { x: -1 * STEP_X, y: -2 * STEP_Y, variant: 's', z: 0 },
  { x: 0, y: -2 * STEP_Y, variant: 's', z: 0 },
  { x: 1 * STEP_X, y: -2 * STEP_Y, variant: 's', z: 0 },
  { x: 2 * STEP_X, y: -2 * STEP_Y, variant: 's', z: 0 },
  { x: -2.5 * STEP_X, y: -STEP_Y, variant: 's', z: 0 },
  { x: 2.5 * STEP_X, y: -STEP_Y, variant: 's', z: 0 },
  { x: -3 * STEP_X, y: 0, variant: 's', z: 0 },
  { x: 3 * STEP_X, y: 0, variant: 's', z: 0 },
  { x: -2.5 * STEP_X, y: STEP_Y, variant: 's', z: 0 },
  { x: 2.5 * STEP_X, y: STEP_Y, variant: 's', z: 0 },
  { x: -2 * STEP_X, y: 2 * STEP_Y, variant: 's', z: 0 },
  { x: -1 * STEP_X, y: 2 * STEP_Y, variant: 's', z: 0 },
  { x: 0, y: 2 * STEP_Y, variant: 's', z: 0 },
  { x: 1 * STEP_X, y: 2 * STEP_Y, variant: 's', z: 0 },
  { x: 2 * STEP_X, y: 2 * STEP_Y, variant: 's', z: 0 },

  // Main row 1 (top)
  { x: -1.5 * STEP_X, y: -STEP_Y, variant: 's', z: 1 },
  { x: -0.5 * STEP_X, y: -STEP_Y, variant: 'c', z: 2 },
  { x: 0.5 * STEP_X, y: -STEP_Y, variant: 'c', z: 2 },
  { x: 1.5 * STEP_X, y: -STEP_Y, variant: 's', z: 1 },

  // Main row 2 (center)
  { x: -2 * STEP_X, y: 0, variant: 's', z: 1 },
  { x: -1 * STEP_X, y: 0, variant: 'c', z: 4, iconSet: 'dark', slot: 0 },
  { x: 0, y: 0, variant: 'm', z: 5, iconSet: 'white', slot: 1 },
  { x: 1 * STEP_X, y: 0, variant: 'c', z: 4, iconSet: 'dark', slot: 2 },
  { x: 2 * STEP_X, y: 0, variant: 's', z: 1 },

  // Main row 3 (bottom)
  { x: -1.5 * STEP_X, y: STEP_Y, variant: 's', z: 1 },
  { x: -0.5 * STEP_X, y: STEP_Y, variant: 'c', z: 2 },
  { x: 0.5 * STEP_X, y: STEP_Y, variant: 'c', z: 2 },
  { x: 1.5 * STEP_X, y: STEP_Y, variant: 's', z: 1 }
]

const SCENE_W = 7 * STEP_X + HEX_W // 1184
const SCENE_H = 5 * STEP_Y + HEX_H // 799.5

function ringOf(h: Hex): number {
  if (h.variant === 'm') return 0
  const cx = Math.round((h.x / STEP_X) * 2)
  const ry = Math.round(h.y / STEP_Y)
  return Math.max(Math.abs(ry), Math.ceil((Math.abs(cx) + Math.abs(ry)) / 2))
}

/* ------------------------------------------------------------------ */
/* Icon randomization                                                  */
/* ------------------------------------------------------------------ */
function pickUniqueTriplet(prev?: string[]): string[] {
  const pool = [...ICON_INDEXES] as string[]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const pick = pool.slice(0, 3)
  if (prev) {
    for (let s = 0; s < 3; s++) {
      if (pick[s] === prev[s]) {
        const swap = pool.find((p) => !pick.includes(p))
        if (swap) pick[s] = swap
      }
    }
  }
  return pick
}

type IconLayerStatus = 'current' | 'incoming' | 'outgoing'
interface IconLayer {
  id: number
  icons: string[]
  status: IconLayerStatus
}

const iconLayers = ref<IconLayer[]>([{ id: 0, icons: pickUniqueTriplet(), status: 'incoming' }])
let currentLayer = { id: iconLayers.value[0].id, icons: iconLayers.value[0].icons }
let layerId = 0

function phaseClass(status: IconLayerStatus): string {
  return status === 'incoming' ? 'hex-icon-in' : status === 'outgoing' ? 'hex-icon-out' : 'hex-icon-current'
}

function iconSrcFor(layer: IconLayer, iconSet: 'dark' | 'white', slot: number): string {
  return iconSet === 'white' ? whiteSrc(layer.icons[slot]) : darkSrc(layer.icons[slot])
}

/* ------------------------------------------------------------------ */
/* Breathing (requestAnimationFrame)                                   */
/* ------------------------------------------------------------------ */
const t = ref(0)
const PERIOD = 3200
const AMP = 0.1
const RING_DELAY = 0.08

function hexStyle(h: Hex): Record<string, string> {
  const phase = t.value
  const wave = Math.sin(phase * Math.PI * 2)
  let s: number
  if (h.variant === 'm') {
    s = 1 + AMP * wave
  } else {
    const r = ringOf(h)
    const w = Math.sin((phase - r * RING_DELAY) * Math.PI * 2)
    s = 1 - AMP * w
  }
  const tx = h.variant === 'm' ? 0 : h.x * s
  const ty = h.variant === 'm' ? 0 : h.y * s
  return {
    zIndex: String(h.z),
    transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px)`,
    '--hex-scale': String(s)
  }
}

/* ------------------------------------------------------------------ */
/* Progress bar                                                        */
/* ------------------------------------------------------------------ */
const progress = ref(0)

/* ------------------------------------------------------------------ */
/* Lifecycle / timers                                                  */
/* ------------------------------------------------------------------ */
let raf = 0
let startTime: number | null = null
let progressTimeout: ReturnType<typeof setTimeout> | undefined
const iconTimeouts: Array<ReturnType<typeof setTimeout>> = []
let mounted = true

function beginTransition(): void {
  const previous = currentLayer
  const nextIcons = pickUniqueTriplet(previous.icons)
  const nextId = layerId + 1
  layerId = nextId
  currentLayer = { id: nextId, icons: nextIcons }

  iconLayers.value = [
    { id: previous.id, icons: previous.icons, status: 'outgoing' },
    { id: nextId, icons: nextIcons, status: 'incoming' }
  ]

  schedule(() => {
    iconLayers.value = [{ id: nextId, icons: nextIcons, status: 'current' }]
    schedule(beginTransition, HOLD)
  }, FADE)
}

const FADE = 500
const HOLD = 2000

function schedule(cb: () => void, delay: number): void {
  iconTimeouts.push(
    setTimeout(() => {
      if (!mounted) return
      cb()
    }, delay)
  )
}

onMounted(() => {
  // Preload all 22 icon files once.
  ICON_INDEXES.forEach((n) => {
    const a = new Image()
    a.src = darkSrc(n)
    const b = new Image()
    b.src = whiteSrc(n)
  })

  // Breathing loop.
  const tickRaf = (now: number): void => {
    if (startTime == null) startTime = now
    const elapsed = (now - startTime) % PERIOD
    t.value = elapsed / PERIOD
    raf = requestAnimationFrame(tickRaf)
  }
  raf = requestAnimationFrame(tickRaf)

  // Progress bar loop.
  const tickProgress = (): void => {
    if (!mounted) return
    const p = progress.value
    if (p >= 100) {
      progress.value = 0
    } else {
      const jump = Math.random() < 0.35 ? Math.random() * 2 + 0.5 : Math.random() * 16 + 3
      progress.value = Math.min(100, p + jump)
    }
    progressTimeout = setTimeout(tickProgress, 200 + Math.random() * 700)
  }
  progressTimeout = setTimeout(tickProgress, 300)

  // Icon cycle: settle the initial incoming layer, then start transitions.
  schedule(() => {
    iconLayers.value = [{ id: currentLayer.id, icons: currentLayer.icons, status: 'current' }]
    schedule(beginTransition, HOLD)
  }, FADE)
})

onBeforeUnmount(() => {
  mounted = false
  cancelAnimationFrame(raf)
  if (progressTimeout) clearTimeout(progressTimeout)
  iconTimeouts.forEach(clearTimeout)
})
</script>

<template>
  <div class="hex-root">
    <div class="hex-scene" :style="{ width: SCENE_W + 'px', height: SCENE_H + 'px' }">
      <!-- Polygon tiles -->
      <div v-for="(h, i) in HEXES" :key="i" class="hex-wrap" :style="hexStyle(h)">
        <img class="hex-img" :src="SRC_BY_VARIANT[h.variant]" alt="" draggable="false" />

        <!-- Icons only inside the three center-row interactive polygons -->
        <template v-if="h.iconSet && h.slot != null">
          <img
            v-for="layer in iconLayers"
            :key="layer.id"
            class="hex-icon"
            :class="phaseClass(layer.status)"
            :style="{ zIndex: layer.status === 'incoming' ? 11 : 10 }"
            :src="iconSrcFor(layer, h.iconSet, h.slot)"
            alt=""
            draggable="false"
          />
        </template>
      </div>

      <!-- Center blue glow (z 3, behind active row, above top/bottom c-polygons) -->
      <div class="hex-glow" />
    </div>

    <!-- Loading text + progress bar (outside the masked scene) -->
    <div class="hex-status">
      <div class="loading-text">Loading Resources</div>
      <div class="hex-progress">
        <div class="hex-progress-fill" :style="{ width: progress + '%' }" />
      </div>
    </div>
  </div>
</template>

<style>
/* keyframes + helper classes are global so dynamic class swaps animate */
@keyframes hexFadeInRight {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) translateX(20px);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) translateX(0);
  }
}
@keyframes hexFadeOutLeft {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) translateX(0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) translateX(-20px);
  }
}
@keyframes loadingShimmer {
  0% {
    background-position: 250% 0;
  }
  100% {
    background-position: -150% 0;
  }
}

.hex-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32px;
  height: 32px;
  display: block;
  opacity: 1;
  transform: translate(-50%, -50%);
  transform-origin: center center;
  backface-visibility: hidden;
  will-change: opacity, transform;
  pointer-events: none;
}
.hex-icon-current {
  animation: none;
}
.hex-icon-in {
  animation: hexFadeInRight 0.5s ease-out forwards;
}
.hex-icon-out {
  animation: hexFadeOutLeft 0.5s ease-in forwards;
}

.loading-text {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(40, 50, 80, 0.45);
  background: linear-gradient(
    115deg,
    rgba(40, 50, 80, 0.45) 0%,
    rgba(40, 50, 80, 0.45) 40%,
    rgba(71, 112, 189, 1) 50%,
    rgba(40, 50, 80, 0.45) 60%,
    rgba(40, 50, 80, 0.45) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: loadingShimmer 2.4s ease-in infinite;
}
</style>

<style scoped>
.hex-root {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 100vh;
  width: 100%;
  background: radial-gradient(ellipse at center, #eef1f8 0%, #dde2ed 100%);
}

.hex-scene {
  position: relative;
  -webkit-mask-image: radial-gradient(
    ellipse 45% 55% at center,
    #000 0%,
    rgba(0, 0, 0, 0.85) 30%,
    rgba(0, 0, 0, 0.35) 60%,
    transparent 90%
  );
  mask-image: radial-gradient(
    ellipse 45% 55% at center,
    #000 0%,
    rgba(0, 0, 0, 0.85) 30%,
    rgba(0, 0, 0, 0.35) 60%,
    transparent 90%
  );
}

.hex-wrap {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 141px;
  height: 155px;
}

.hex-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 141px;
  height: auto;
  transform: scale(var(--hex-scale, 1));
  transform-origin: center center;
  user-select: none;
  pointer-events: none;
}

.hex-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(71, 112, 189, 0.7);
  filter: blur(37px);
  transform: translate(-50%, -50%);
  z-index: 3;
  pointer-events: none;
}

.hex-status {
  position: absolute;
  bottom: calc(48px + 7vh);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: min(360px, 70vw);
}

.hex-progress {
  width: 100%;
  height: 3px;
  background: rgba(40, 50, 80, 0.12);
  overflow: hidden;
}

.hex-progress-fill {
  height: 100%;
  background: rgba(71, 112, 189, 0.95);
  width: 0;
  transition: width 0.35s ease-out;
}
</style>
