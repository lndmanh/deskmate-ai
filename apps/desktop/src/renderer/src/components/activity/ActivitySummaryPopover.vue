<script setup lang="ts">
import { Clock, Gauge, GripHorizontal, Layers, Maximize2, MoonStar, Play, Shuffle, X } from '@lucide/vue'
import { useStorage } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useActivityData } from '@/composables/useActivityData'
import { useActivityPanels } from '@/composables/useActivityPanels'
import {
  categoryBreakdown,
  formatDuration,
  formatShortDate,
  hasActivity,
  summarize
} from '@/lib/activity-insights'

const { today, status, isTracking, startTracking } = useActivityData()
const { isPopoverOpen, closePopover, openDialog } = useActivityPanels()

const day = computed(() => today.value)
const stats = computed(() => summarize(day.value))
const slices = computed(() => categoryBreakdown(day.value))
const legend = computed(() => slices.value.slice(0, 4))
const hasData = computed(() => hasActivity(day.value))

// --- Dragging -------------------------------------------------------------
const PANEL_WIDTH = 344
const panelRef = ref<HTMLElement | null>(null)
const position = useStorage<{ x: number; y: number } | null>('deskmate:activity-popover-pos', null)
const dragging = ref(false)

function defaultPosition(): { x: number; y: number } {
  return { x: Math.max(12, Math.round(window.innerWidth / 2 - PANEL_WIDTH / 2)), y: 64 }
}

function clampToViewport(x: number, y: number): { x: number; y: number } {
  const width = panelRef.value?.offsetWidth ?? PANEL_WIDTH
  const height = panelRef.value?.offsetHeight ?? 340
  const maxX = Math.max(12, window.innerWidth - width - 12)
  const maxY = Math.max(12, window.innerHeight - height - 12)
  return { x: Math.min(Math.max(x, 12), maxX), y: Math.min(Math.max(y, 12), maxY) }
}

const positionStyle = computed(() => {
  const pos = position.value ?? defaultPosition()
  return { left: `${pos.x}px`, top: `${pos.y}px` }
})

let startX = 0
let startY = 0
let originX = 0
let originY = 0

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value) return
  position.value = clampToViewport(originX + (event.clientX - startX), originY + (event.clientY - startY))
}

function onPointerUp(): void {
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

function onHandlePointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  dragging.value = true
  const pos = position.value ?? defaultPosition()
  startX = event.clientX
  startY = event.clientY
  originX = pos.x
  originY = pos.y
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function keepInViewport(): void {
  const pos = position.value ?? defaultPosition()
  position.value = clampToViewport(pos.x, pos.y)
}

// Ensure a sane starting spot and keep the panel on-screen as it opens / resizes.
watch(isPopoverOpen, (open) => {
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

function viewDetails(): void {
  openDialog()
}

async function onStartTracking(): Promise<void> {
  try {
    await startTracking()
  } catch {
    // Surface-free: the dashboard exposes tracker errors in detail.
  }
}
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
        v-if="isPopoverOpen"
        ref="panelRef"
        class="fixed z-[60] w-[344px] origin-top overflow-hidden rounded-xl border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-xl select-none supports-[backdrop-filter]:bg-popover/80"
        :style="positionStyle"
        role="dialog"
        aria-label="Today's activity summary"
      >
        <!-- Drag handle / header -->
        <div
          class="flex items-center gap-2 border-b px-3 py-2.5"
          :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
          style="touch-action: none"
          @pointerdown="onHandlePointerDown"
        >
          <GripHorizontal class="size-4 text-muted-foreground" />
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-semibold">Today</span>
            <span class="text-[11px] text-muted-foreground">
              {{ stats.date ? formatShortDate(stats.date) : '—' }}
            </span>
          </div>
          <Badge :variant="isTracking ? 'success' : 'secondary'" class="ml-auto">
            {{ isTracking ? 'Tracking' : 'Paused' }}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close summary"
            @pointerdown.stop
            @click="closePopover"
          >
            <X class="size-4" />
          </Button>
        </div>

        <!-- Body -->
        <div v-if="hasData" class="flex flex-col gap-3 p-3">
          <div class="flex items-end justify-between">
            <div>
              <p class="text-xs text-muted-foreground">Focused time</p>
              <p class="text-2xl font-semibold tracking-tight">{{ formatDuration(stats.activeMs) }}</p>
            </div>
            <div v-if="isTracking && status?.currentApp" class="text-right">
              <p class="text-[11px] text-muted-foreground">Now</p>
              <p class="max-w-[150px] truncate text-xs font-medium">{{ status.currentApp }}</p>
            </div>
          </div>

          <!-- Category split bar -->
          <div class="flex flex-col gap-1.5">
            <div class="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                v-for="slice in slices"
                :key="slice.category"
                class="h-full first:rounded-l-full last:rounded-r-full"
                :style="{ width: `${slice.pct}%`, backgroundColor: slice.color }"
                :title="`${slice.label} · ${formatDuration(slice.activeMs)}`"
              />
            </div>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <span
                v-for="slice in legend"
                :key="slice.category"
                class="flex items-center gap-1 text-[11px] text-muted-foreground"
              >
                <span class="size-2 rounded-full" :style="{ backgroundColor: slice.color }" />
                {{ slice.label }} {{ Math.round(slice.pct) }}%
              </span>
            </div>
          </div>

          <!-- Stat grid -->
          <div class="grid grid-cols-2 gap-2">
            <div class="flex items-center gap-2 rounded-lg border bg-background/40 px-2.5 py-2">
              <Layers class="size-4 text-muted-foreground" />
              <div>
                <p class="text-sm font-semibold leading-none">{{ stats.sessionCount }}</p>
                <p class="text-[11px] text-muted-foreground">sessions</p>
              </div>
            </div>
            <div class="flex items-center gap-2 rounded-lg border bg-background/40 px-2.5 py-2">
              <Gauge class="size-4 text-muted-foreground" />
              <div>
                <p class="text-sm font-semibold leading-none">{{ Math.round(stats.focusRatio * 100) }}%</p>
                <p class="text-[11px] text-muted-foreground">focus</p>
              </div>
            </div>
            <div class="flex items-center gap-2 rounded-lg border bg-background/40 px-2.5 py-2">
              <Shuffle class="size-4 text-muted-foreground" />
              <div>
                <p class="text-sm font-semibold leading-none">{{ stats.contextSwitches }}</p>
                <p class="text-[11px] text-muted-foreground">switches</p>
              </div>
            </div>
            <div class="flex items-center gap-2 rounded-lg border bg-background/40 px-2.5 py-2">
              <MoonStar class="size-4 text-muted-foreground" />
              <div>
                <p class="text-sm font-semibold leading-none">{{ formatDuration(stats.lateNightMs) }}</p>
                <p class="text-[11px] text-muted-foreground">late night</p>
              </div>
            </div>
          </div>

          <p v-if="stats.topApp" class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock class="size-3.5" />
            Most used:
            <span class="font-medium text-foreground">{{ stats.topApp.app }}</span>
            · {{ formatDuration(stats.topApp.activeMs) }}
          </p>
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center gap-3 px-4 py-6 text-center">
          <p class="text-sm text-muted-foreground">
            No focused activity tracked yet today. Start tracking to see your work rhythm here.
          </p>
          <Button v-if="!isTracking" size="sm" @click="onStartTracking">
            <Play class="size-4" /> Start tracking
          </Button>
        </div>

        <!-- Footer -->
        <div class="border-t p-3">
          <Button class="w-full" variant="default" @click="viewDetails">
            <Maximize2 class="size-4" /> View details
          </Button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
