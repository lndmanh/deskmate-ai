<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '.'
import { ref } from 'vue'
import { Primitive } from 'reka-ui'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '.'

interface Ripple {
  id: number
  x: number
  y: number
}

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  rippleScale?: number
  rippleDuration?: number
  isLoading?: boolean
  loadingLabel?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  rippleScale: 10,
  rippleDuration: 600,
  isLoading: false,
  loadingLabel: 'Loading',
  disabled: false,
})

type ButtonRef = HTMLElement | { $el: unknown }

const buttonRef = ref<ButtonRef | null>(null)
const ripples = ref<Ripple[]>([])

function getButtonElement(button: ButtonRef | null): HTMLElement | null {
  if (button instanceof HTMLElement) return button
  if (button && button.$el instanceof HTMLElement) return button.$el
  return null
}

function handleClick(event: MouseEvent) {
  if (props.disabled || props.isLoading) return

  const button = getButtonElement(buttonRef.value)
  if (!button) return

  const rect = button.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const ripple: Ripple = { id: Date.now(), x, y }
  ripples.value.push(ripple)

  setTimeout(() => {
    ripples.value = ripples.value.filter(r => r.id !== ripple.id)
  }, props.rippleDuration)
}
</script>

<template>
  <Primitive
    ref="buttonRef"
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), 'relative overflow-hidden', props.class)"
    :disabled="props.disabled || props.isLoading"
    @click="handleClick"
  >
    <Spinner
      v-if="isLoading"
      variant="default"
      size="sm"
      :label="loadingLabel"
      class="text-current"
    />
    <slot v-else />
    <span
      v-for="ripple in ripples"
      :key="ripple.id"
      class="ripple-effect pointer-events-none absolute size-5 rounded-full bg-current"
      :style="{
        'top': `${ripple.y - 10}px`,
        'left': `${ripple.x - 10}px`,
        'animationDuration': `${rippleDuration}ms`,
        '--ripple-scale': rippleScale,
      }"
    />
  </Primitive>
</template>
