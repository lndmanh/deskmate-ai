<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Laugh,
  MoonStar,
  PersonStanding,
  Smile,
  Sparkles,
  Wind
} from '@lucide/vue'
import { useEventListener, useWindowSize } from '@vueuse/core'
import { AnimatePresence, motion } from 'motion-v'
import { computed, nextTick, ref, watch } from 'vue'
import type { Component } from 'vue'

import { Button } from '@/components/ui/button'
import { useMascot } from '@/composables/useMascot'
import type { MascotMotion } from '@/types/mascot'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { motions, currentPersonality, cyclePersonality, playMotion } = useMascot()

// Ring geometry: items sit on a circle of this radius around the mascot, leaving
// the centre clear so the avatar stays visible.
const RADIUS = 116
// The personality pill floats this far above the centre, clearing the top item.
const PILL_OFFSET = RADIUS + 78
// The circular "dial" the buttons sit on. Its centre is punched out so the
// mascot stays visible; sizes are in px and scale with the ring (ringScale).
const TRACK_OUTER = 154
const TRACK_INNER = 80
const TRACK_MASK = `radial-gradient(circle at center, transparent ${TRACK_INNER}px, black ${TRACK_INNER + 2}px)`

const menuRef = ref<HTMLElement | null>(null)

// Shrink the whole ring on small windows so it never overflows the viewport.
const { width, height } = useWindowSize()
const ringScale = computed(() => {
  const smallest = Math.min(width.value, height.value)
  return Math.min(1, Math.max(0.78, smallest / 520))
})

const motionIcons: Record<string, Component> = {
  waiting: MoonStar,
  appearing: Sparkles,
  liked: Heart,
  happy: Smile,
  laughing: Laugh,
  stretching: PersonStanding
}

function iconFor(name: string): Component {
  return motionIcons[name] ?? Wind
}

function formatLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// Resting offset for the item at `index`, spread evenly around the ring from the
// top. motion-v drives the full transform (x/y/scale together), so positioning
// and the bloom/press animations never fight over the `transform` property.
function ringPoint(index: number, count: number): { x: number; y: number } {
  const angle = (-90 + (360 / count) * index) * (Math.PI / 180)
  return { x: Math.cos(angle) * RADIUS, y: Math.sin(angle) * RADIUS }
}

function select(motion: MascotMotion): void {
  playMotion(motion.name)
  emit('close')
}

// --- Keyboard support: Escape closes; arrows/Home/End move focus round the ring. ---
function items(): HTMLElement[] {
  const root = menuRef.value
  if (!root) return []
  return Array.from(root.querySelectorAll('[data-radial-item]')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement
  )
}

function focusItem(index: number): void {
  const all = items()
  if (all.length === 0) return
  all[(index + all.length) % all.length].focus()
}

function moveFocus(delta: number): void {
  const all = items()
  const current = all.findIndex((el) => el === document.activeElement)
  focusItem((current === -1 ? 0 : current) + delta)
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault()
      moveFocus(1)
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault()
      moveFocus(-1)
      break
    case 'Home':
      event.preventDefault()
      focusItem(0)
      break
    case 'End':
      event.preventDefault()
      focusItem(-1)
      break
  }
}

useEventListener(window, 'keydown', onKeydown)

// Move focus into the ring once it opens so it is immediately keyboard-drivable.
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    await nextTick()
    focusItem(0)
  }
)
</script>

<template>
  <AnimatePresence>
    <motion.div
      v-if="open"
      key="mascot-radial"
      class="fixed inset-0 z-40 flex items-center justify-center"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 1 }"
      :exit="{ opacity: 0 }"
      :transition="{ duration: 0.15 }"
      @pointerdown.self="emit('close')"
    >
      <div
        ref="menuRef"
        class="relative"
        :style="{ transform: `scale(${ringScale})` }"
        role="menu"
        aria-label="Mascot actions"
      >
        <!-- Circular dial the buttons sit on; centre is punched out for the mascot -->
        <motion.div
          class="border-border/50 bg-background/25 pointer-events-none absolute top-1/2 left-1/2 rounded-full border shadow-xl"
          :style="{
            width: `${TRACK_OUTER * 2}px`,
            height: `${TRACK_OUTER * 2}px`,
            marginTop: `-${TRACK_OUTER}px`,
            marginLeft: `-${TRACK_OUTER}px`,
            maskImage: TRACK_MASK,
            WebkitMaskImage: TRACK_MASK
          }"
          :initial="{ opacity: 0, scale: 0.9 }"
          :animate="{ opacity: 1, scale: 1 }"
          :transition="{ duration: 0.2 }"
        />
        <!-- Hairline marking the inner edge of the dial -->
        <div
          class="border-border/50 pointer-events-none absolute top-1/2 left-1/2 rounded-full border"
          :style="{
            width: `${TRACK_INNER * 2}px`,
            height: `${TRACK_INNER * 2}px`,
            marginTop: `-${TRACK_INNER}px`,
            marginLeft: `-${TRACK_INNER}px`
          }"
        />

        <!-- Personality selector, floating above the ring -->
        <div class="absolute left-1/2 -translate-x-1/2" :style="{ top: `-${PILL_OFFSET}px` }">
          <motion.div
            class="bg-background/90 supports-backdrop-filter:bg-background/70 flex items-center gap-1 rounded-full border p-1 shadow-lg backdrop-blur"
            role="group"
            aria-label="Personality"
            :initial="{ opacity: 0, y: -6 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.18 }"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              class="size-7 rounded-full"
              aria-label="Previous personality"
              @click="cyclePersonality(-1)"
            >
              <ChevronLeft class="size-4" />
            </Button>
            <span class="min-w-20 text-center text-xs font-medium" aria-live="polite">
              {{ currentPersonality.label }}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              class="size-7 rounded-full"
              aria-label="Next personality"
              @click="cyclePersonality(1)"
            >
              <ChevronRight class="size-4" />
            </Button>
          </motion.div>
        </div>

        <!-- Motion buttons, blooming out from the mascot's centre -->
        <AnimatePresence>
          <motion.button
            v-for="(item, index) in motions"
            :key="item.name"
            data-radial-item
            type="button"
            role="menuitem"
            class="bg-background/90 supports-backdrop-filter:bg-background/70 hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute top-1/2 left-1/2 -mt-7 -ml-7 flex size-14 flex-col items-center justify-center gap-0.5 rounded-full border shadow-lg outline-none backdrop-blur focus-visible:ring-[3px]"
            :initial="{ opacity: 0, scale: 0.4, x: 0, y: 0 }"
            :animate="{ opacity: 1, scale: 1, ...ringPoint(index, motions.length) }"
            :exit="{ opacity: 0, scale: 0.4, x: 0, y: 0 }"
            :transition="{
              type: 'spring',
              stiffness: 360,
              damping: 26,
              mass: 0.6,
              delay: index * 0.025
            }"
            :while-hover="{ scale: 1.12 }"
            :while-press="{ scale: 0.92 }"
            :aria-label="`Play ${formatLabel(item.name)} motion`"
            @click="select(item)"
          >
            <component :is="iconFor(item.name)" class="size-5" />
            <span class="text-[10px] leading-none font-medium">{{ formatLabel(item.name) }}</span>
          </motion.button>
        </AnimatePresence>

        <!-- Dismiss hint -->
        <motion.p
          class="text-muted-foreground pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap"
          :style="{ top: `${RADIUS + 52}px` }"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :transition="{ duration: 0.2, delay: 0.12 }"
        >
          Tap outside or press Esc to close
        </motion.p>
      </div>
    </motion.div>
  </AnimatePresence>
</template>
