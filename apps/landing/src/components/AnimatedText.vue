<script setup lang="ts">
import { computed } from 'vue'
import { useReveal } from '@/composables/useReveal'

const props = withDefaults(
  defineProps<{
    delay?: number
  }>(),
  { delay: 0.15 }
)

const { setRef, visible } = useReveal()
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const style = computed(() => {
  const t = `0.7s ${EASE} ${props.delay}s`
  return {
    opacity: visible.value ? '1' : '0',
    transform: visible.value ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity ${t}, transform ${t}`,
    willChange: 'opacity, transform'
  }
})
</script>

<template>
  <p :ref="setRef" :style="style">
    <slot />
  </p>
</template>
