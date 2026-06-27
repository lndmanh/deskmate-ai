<script setup lang="ts">
import { GripHorizontal, Pause, Play, RotateCcw, SkipForward, X } from '@lucide/vue'
import { useStorage } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'

type Phase = 'focus' | 'short-break' | 'long-break'

const DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  'short-break': 5 * 60,
  'long-break': 15 * 60,
}

const PHASE_LABELS: Record<Phase, string> = {
  focus: 'Focus',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
}

const isOpen = defineModel<boolean>({ required: true })

const phase = ref<Phase>('focus')
const pomodorosCompleted = ref(0)
const timeLeft = ref(DURATIONS.focus)
const isRunning = ref(false)
let intervalId: ReturnType<typeof setInterval> | null = null

const totalTime = computed(() => DURATIONS[phase.value])
const progress = computed(() => timeLeft.value / totalTime.value)
const minutes = computed(() => Math.floor(timeLeft.value / 60).toString().padStart(2, '0'))
const seconds = computed(() => (timeLeft.value % 60).toString().padStart(2, '0'))
const completedInCycle = computed(() => pomodorosCompleted.value % 4)

// SVG ring
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const strokeDashoffset = computed(() => CIRCUMFERENCE * (1 - progress.value))

const ringColor = computed(() => {
  switch (phase.value) {
    case 'focus': return '#fb923c'       // orange-400
    case 'short-break': return '#34d399' // emerald-400
    case 'long-break': return '#60a5fa'  // blue-400
  }
})

const phaseBadgeClass = (p: Phase) =>
  p === phase.value
    ? 'bg-foreground/10 text-foreground font-medium'
    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'

function tick(): void {
  if (timeLeft.value <= 0) {
    stopInterval()
    advancePhase()
    return
  }
  timeLeft.value--
}

function stopInterval(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function start(): void {
  isRunning.value = true
  intervalId = setInterval(tick, 1000)
}

function pause(): void {
  isRunning.value = false
  stopInterval()
}

function toggleTimer(): void {
  if (isRunning.value) pause()
  else start()
}

function reset(): void {
  pause()
  timeLeft.value = DURATIONS[phase.value]
}

function advancePhase(): void {
  if (phase.value === 'focus') {
    pomodorosCompleted.value++
    phase.value = pomodorosCompleted.value % 4 === 0 ? 'long-break' : 'short-break'
  } else {
    phase.value = 'focus'
  }
  timeLeft.value = DURATIONS[phase.value]
  isRunning.value = false
}

function setPhase(p: Phase): void {
  pause()
  phase.value = p
  timeLeft.value = DURATIONS[p]
}

onBeforeUnmount(stopInterval)

// --- Dragging ---
const PANEL_WIDTH = 288
const panelRef = ref<HTMLElement | null>(null)
const position = useStorage<{ x: number; y: number } | null>('deskmate:pomodoro-pos', null)
const dragging = ref(false)

function defaultPosition(): { x: number; y: number } {
  return { x: window.innerWidth - PANEL_WIDTH - 20, y: 64 }
}

function clampToViewport(x: number, y: number): { x: number; y: number } {
  const width = panelRef.value?.offsetWidth ?? PANEL_WIDTH
  const height = panelRef.value?.offsetHeight ?? 360
  return {
    x: Math.min(Math.max(x, 12), Math.max(12, window.innerWidth - width - 12)),
    y: Math.min(Math.max(y, 12), Math.max(12, window.innerHeight - height - 12)),
  }
}

const positionStyle = computed(() => {
  const pos = position.value ?? defaultPosition()
  return { left: `${pos.x}px`, top: `${pos.y}px` }
})

let startX = 0, startY = 0, originX = 0, originY = 0

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return
  position.value = clampToViewport(originX + (e.clientX - startX), originY + (e.clientY - startY))
}

function onPointerUp(): void {
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

function onHandlePointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  dragging.value = true
  const pos = position.value ?? defaultPosition()
  startX = e.clientX; startY = e.clientY
  originX = pos.x; originY = pos.y
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function keepInViewport(): void {
  const pos = position.value ?? defaultPosition()
  position.value = clampToViewport(pos.x, pos.y)
}

watch(isOpen, (open) => {
  if (!open) return
  if (!position.value) position.value = defaultPosition()
  requestAnimationFrame(keepInViewport)
})

onMounted(() => window.addEventListener('resize', keepInViewport))
onBeforeUnmount(() => {
  window.removeEventListener('resize', keepInViewport)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="panelRef"
        class="fixed z-[60] w-72 origin-top overflow-hidden rounded-xl border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-xl select-none supports-[backdrop-filter]:bg-popover/80"
        :style="positionStyle"
        role="dialog"
        aria-label="Pomodoro timer"
      >
        <!-- Drag handle / header -->
        <div
          class="flex items-center gap-2 border-b px-3 py-2.5"
          :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
          style="touch-action: none"
          @pointerdown="onHandlePointerDown"
        >
          <GripHorizontal class="size-4 text-muted-foreground" />
          <span class="text-sm font-semibold">Pomodoro</span>
          <Button
            variant="ghost"
            size="icon-sm"
            class="ml-auto"
            aria-label="Close pomodoro"
            @pointerdown.stop
            @click="isOpen = false"
          >
            <X class="size-4" />
          </Button>
        </div>

        <!-- Phase selector -->
        <div class="flex gap-1 px-3 pt-3">
          <button
            v-for="p in (['focus', 'short-break', 'long-break'] as Phase[])"
            :key="p"
            class="rounded-md px-2 py-1 text-xs transition-colors"
            :class="phaseBadgeClass(p)"
            @click="setPhase(p)"
          >
            {{ PHASE_LABELS[p] }}
          </button>
        </div>

        <!-- Timer ring -->
        <div class="flex flex-col items-center gap-4 px-3 py-5">
          <div class="relative flex size-40 items-center justify-center">
            <svg viewBox="0 0 120 120" class="absolute inset-0 size-full -rotate-90">
              <circle
                cx="60" cy="60" :r="RADIUS"
                fill="none" stroke="currentColor"
                stroke-width="7"
                class="text-muted/40"
              />
              <circle
                cx="60" cy="60" :r="RADIUS"
                fill="none"
                :stroke="ringColor"
                stroke-width="7"
                stroke-linecap="round"
                :stroke-dasharray="CIRCUMFERENCE"
                :stroke-dashoffset="strokeDashoffset"
                style="transition: stroke-dashoffset 1s linear, stroke 0.4s ease"
              />
            </svg>
            <div class="relative flex flex-col items-center">
              <span class="font-mono text-4xl font-semibold tabular-nums tracking-tight">
                {{ minutes }}:{{ seconds }}
              </span>
              <span class="text-xs text-muted-foreground">{{ PHASE_LABELS[phase] }}</span>
            </div>
          </div>

          <!-- Pomodoro cycle dots -->
          <div class="flex items-center gap-2">
            <span
              v-for="i in 4"
              :key="i"
              class="size-2 rounded-full transition-colors duration-300"
              :style="{ backgroundColor: i <= completedInCycle ? ringColor : '' }"
              :class="i <= completedInCycle ? '' : 'bg-muted'"
            />
            <span class="ml-1 text-xs text-muted-foreground">
              #{{ Math.floor(pomodorosCompleted / 4) * 4 + completedInCycle + (phase === 'focus' ? 1 : 0) }}
            </span>
          </div>

          <!-- Controls -->
          <div class="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Reset timer" @click="reset">
              <RotateCcw class="size-4" />
            </Button>
            <Button
              size="icon"
              class="size-12 rounded-full shadow-md"
              :style="{ backgroundColor: ringColor, color: '#fff' }"
              aria-label="Toggle timer"
              @click="toggleTimer"
            >
              <Pause v-if="isRunning" class="size-5" />
              <Play v-else class="size-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Skip phase" @click="advancePhase">
              <SkipForward class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
