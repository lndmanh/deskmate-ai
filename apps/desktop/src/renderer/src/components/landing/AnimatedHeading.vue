<script setup lang="ts">
import { computed } from 'vue'
import { useReveal } from '@/composables/useReveal'

const props = withDefaults(
  defineProps<{
    as?: string
    delay?: number
  }>(),
  { as: 'h2', delay: 0 }
)

const { setRef, visible } = useReveal()
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const style = computed(() => {
  const t = `0.9s ${EASE} ${props.delay}s`
  return {
    opacity: visible.value ? '1' : '0',
    transform: visible.value ? 'translateY(0)' : 'translateY(30px)',
    filter: visible.value ? 'blur(0px)' : 'blur(12px)',
    transition: `opacity ${t}, transform ${t}, filter ${t}`,
    willChange: 'opacity, transform, filter'
  }
})
</script>

<template>
  <component :is="props.as" :ref="setRef" :style="style">
    <slot />
  </component>
</template>
