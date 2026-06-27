<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowLeft, ArrowRight } from '@lucide/vue'
import MaskedImage from './MaskedImage.vue'
import { ASSETS } from '@/lib/landing-assets'

const TT = '"TT Hoves", "Helvetica Neue", Helvetica, Arial, sans-serif'

// DeskMate's modules stand in for the original team carousel. Portraits are
// placeholders — replace with module illustrations when available.
const modules = [
  { img: ASSETS.blurDoctor, role: 'ACTIVITY', name: 'Work Rhythm' },
  { img: ASSETS.happyDoctor, role: 'ON-DEVICE CV', name: 'Posture & Body' },
  { img: ASSETS.youngDoctor, role: 'WEARABLE', name: 'Recovery' },
  { img: ASSETS.happyDoctor, role: 'MESSAGES', name: 'Communication Strain' },
  { img: ASSETS.blurDoctor, role: 'ATTENTION', name: 'Focus & Cognitive Load' },
  { img: ASSETS.youngDoctor, role: 'SELF CHECK-IN', name: 'Mood Check-in' }
]

const GAP = 11.26
const VISIBLE = 3.25 // 3 full cards + a sliver of the 4th
const maxIndex = Math.max(0, Math.ceil(modules.length - VISIBLE))
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const index = ref(0)
const hovered = ref(false)

const trackWidth = computed(
  () =>
    `calc(${modules.length} * ((100% - ${(VISIBLE - 1) * GAP}px) / ${VISIBLE}) + ${
      (modules.length - 1) * GAP
    }px)`
)
const trackTransform = computed(
  () => `translateX(calc(${-index.value} * (100% + ${GAP}px) / ${modules.length}))`
)
const cardWidth = `calc((100% - ${(modules.length - 1) * GAP}px) / ${modules.length})`

function prev() {
  index.value = Math.max(0, index.value - 1)
}
function next() {
  index.value = Math.min(maxIndex, index.value + 1)
}
</script>

<template>
  <div
    class="relative"
    :style="{ fontFamily: TT }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <div class="flex" :style="{ gap: GAP + 'px' }">
      <!-- intro text column -->
      <div class="shrink-0" style="width: 324px">
        <slot name="intro" />
      </div>

      <!-- viewport -->
      <div class="relative overflow-hidden flex-1 min-w-0">
        <div
          class="flex"
          :style="{
            gap: GAP + 'px',
            width: trackWidth,
            transform: trackTransform,
            transition: `transform 0.7s ${EASE}`
          }"
        >
          <div
            v-for="(m, i) in modules"
            :key="i"
            class="shrink-0"
            :style="{ width: cardWidth, fontFamily: TT }"
          >
            <div class="aspect-[3/4] overflow-hidden bg-muted">
              <MaskedImage :src="m.img" :alt="m.name" class="w-full h-full" :delay="i * 0.08" />
            </div>
            <div class="pt-6">
              <p class="text-xs tracking-[0.2em] text-muted-foreground uppercase">{{ m.role }}</p>
              <p class="text-xl mt-2 font-medium">{{ m.name }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- central hover control -->
    <div class="absolute left-1/2 z-10" style="top: 35%; transform: translate(-50%, -50%)">
      <Transition name="puck">
        <div
          v-if="hovered"
          class="flex items-center justify-center gap-4 rounded-full cursor-pointer"
          :style="{
            width: '126px',
            height: '126px',
            background: 'rgba(72, 72, 72, 0.16)',
            backdropFilter: 'blur(84px)',
            WebkitBackdropFilter: 'blur(84px)'
          }"
        >
          <button
            class="flex items-center justify-center text-white disabled:opacity-30 transition cursor-pointer"
            :disabled="index === 0"
            @click="prev"
          >
            <ArrowLeft class="w-7 h-7" />
          </button>
          <button
            class="flex items-center justify-center text-white disabled:opacity-30 transition cursor-pointer"
            :disabled="index >= maxIndex"
            @click="next"
          >
            <ArrowRight class="w-7 h-7" />
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.puck-enter-active,
.puck-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}
.puck-enter-from,
.puck-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>
