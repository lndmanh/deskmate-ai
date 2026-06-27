<script setup lang="ts">
import { computed } from 'vue'
import { useReveal } from '@/composables/useReveal'

const props = withDefaults(
  defineProps<{
    src: string
    alt?: string
    delay?: number
  }>(),
  { alt: '', delay: 0 }
)

const { setRef, visible } = useReveal()
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

// Reveal downward: fully clipped from the top -> unmasked.
const style = computed(() => ({
  clipPath: visible.value ? 'inset(0% 0 0 0)' : 'inset(100% 0 0 0)',
  transition: `clip-path 1.1s ${EASE} ${props.delay}s`,
  willChange: 'clip-path'
}))
</script>

<template>
  <div :ref="setRef" :style="style">
    <img :src="props.src" :alt="props.alt" class="w-full h-full object-cover" />
  </div>
</template>
