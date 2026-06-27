<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  applyThemeMode,
  getSystemThemeMode,
  readThemePreference,
  resolveThemePreference,
  watchSystemThemeChange,
  type ThemeMode,
  type ThemePreference
} from '@/lib/theme'

type Props = {
  step: number
  totalSteps: number
  title: string
  description?: string
  canContinue?: boolean
  showBack?: boolean
  showSkip?: boolean
  showContinue?: boolean
  continueLabel?: string
}

type ThemeStyle = {
  [key: string]: string
}

const props = defineProps<Props>()
defineEmits<{
  back: []
  continue: []
  skip: []
}>()

const themePreference = ref<ThemePreference>('system')
const systemThemeMode = ref<ThemeMode>(getSystemThemeMode())
let removeSystemThemeListener: (() => void) | undefined

const darkThemeStyle: ThemeStyle = {
  'color-scheme': 'dark',
  '--onboarding-bg': '#0F1117',
  '--onboarding-glow': 'radial-gradient(circle at 18% 18%, rgba(124, 140, 255, 0.28), transparent 34%), radial-gradient(circle at 84% 22%, rgba(125, 211, 199, 0.22), transparent 30%), radial-gradient(circle at 50% 90%, rgba(124, 140, 255, 0.14), transparent 38%)',
  '--onboarding-veil': 'rgba(15, 17, 23, 0.72)',
  '--onboarding-card': 'rgba(28, 30, 38, 0.95)',
  '--onboarding-panel': '#252832',
  '--onboarding-panel-hover': '#2D3140',
  '--onboarding-panel-soft': 'rgba(255, 255, 255, 0.05)',
  '--onboarding-border': 'rgba(255, 255, 255, 0.08)',
  '--onboarding-border-strong': 'rgba(124, 140, 255, 0.7)',
  '--onboarding-text': '#F4F6FA',
  '--onboarding-muted': '#9CA3AF',
  '--onboarding-accent': '#7C8CFF',
  '--onboarding-accent-hover': '#8D9BFF',
  '--onboarding-accent-muted': 'rgba(124, 140, 255, 0.5)',
  '--onboarding-accent-soft': 'rgba(124, 140, 255, 0.16)',
  '--onboarding-teal': '#7DD3C7',
  '--onboarding-teal-soft': 'rgba(125, 211, 199, 0.1)',
  '--onboarding-icon-bg': '#1C1E26',
  '--onboarding-selected': 'rgba(124, 140, 255, 0.16)',
  '--onboarding-selected-ring': 'rgba(124, 140, 255, 0.22)',
  '--onboarding-track': 'rgba(255, 255, 255, 0.1)',
  '--onboarding-disabled': '#4A5069',
  '--onboarding-ring-offset': '#1C1E26',
  '--onboarding-shadow': '0 32px 120px rgba(0, 0, 0, 0.45)'
}

const lightThemeStyle: ThemeStyle = {
  'color-scheme': 'light',
  '--onboarding-bg': '#F4F6FA',
  '--onboarding-glow': 'radial-gradient(circle at 18% 18%, rgba(124, 140, 255, 0.18), transparent 34%), radial-gradient(circle at 84% 22%, rgba(20, 184, 166, 0.15), transparent 30%), radial-gradient(circle at 50% 90%, rgba(15, 23, 42, 0.06), transparent 38%)',
  '--onboarding-veil': 'rgba(244, 246, 250, 0.72)',
  '--onboarding-card': 'rgba(255, 255, 255, 0.96)',
  '--onboarding-panel': '#F8FAFC',
  '--onboarding-panel-hover': '#EEF2FF',
  '--onboarding-panel-soft': 'rgba(15, 23, 42, 0.04)',
  '--onboarding-border': 'rgba(15, 23, 42, 0.12)',
  '--onboarding-border-strong': 'rgba(99, 102, 241, 0.78)',
  '--onboarding-text': '#111827',
  '--onboarding-muted': '#64748B',
  '--onboarding-accent': '#6366F1',
  '--onboarding-accent-hover': '#4F46E5',
  '--onboarding-accent-muted': 'rgba(99, 102, 241, 0.45)',
  '--onboarding-accent-soft': 'rgba(99, 102, 241, 0.12)',
  '--onboarding-teal': '#0F766E',
  '--onboarding-teal-soft': 'rgba(20, 184, 166, 0.1)',
  '--onboarding-icon-bg': '#EEF2FF',
  '--onboarding-selected': 'rgba(99, 102, 241, 0.14)',
  '--onboarding-selected-ring': 'rgba(99, 102, 241, 0.24)',
  '--onboarding-track': 'rgba(15, 23, 42, 0.12)',
  '--onboarding-disabled': '#CBD5E1',
  '--onboarding-ring-offset': '#FFFFFF',
  '--onboarding-shadow': '0 28px 90px rgba(15, 23, 42, 0.16)'
}

const progressLabel = computed(() => {
  if (props.step === 1) return 'Welcome'
  if (props.step === props.totalSteps) return 'Recommendation'

  return `Question ${props.step - 1} of ${props.totalSteps - 2}`
})

const activeThemeMode = computed(() => resolveThemePreference(themePreference.value, systemThemeMode.value))
const isLightMode = computed(() => activeThemeMode.value === 'light')
const themeStyle = computed(() => (isLightMode.value ? lightThemeStyle : darkThemeStyle))

onMounted(() => {
  themePreference.value = readThemePreference()
  systemThemeMode.value = getSystemThemeMode()

  removeSystemThemeListener = watchSystemThemeChange(() => {
    systemThemeMode.value = getSystemThemeMode()
  })
})

onBeforeUnmount(() => {
  if (removeSystemThemeListener) removeSystemThemeListener()
})

watch(
  activeThemeMode,
  (mode) => {
    applyThemeMode(mode)
  },
  { immediate: true }
)
</script>

<template>
  <main :style="themeStyle" class="relative min-h-screen overflow-hidden bg-[color:var(--onboarding-bg)] px-4 py-4 text-[color:var(--onboarding-text)] transition-colors duration-300 sm:px-6 sm:py-8">
    <div class="absolute inset-0 bg-[image:var(--onboarding-glow)]" />
    <div class="absolute inset-0 bg-[color:var(--onboarding-veil)] backdrop-blur-3xl" />

    <section class="relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <Card class="max-h-[calc(100vh-2rem)] w-full max-w-[860px] gap-0 rounded-[24px] border-[color:var(--onboarding-border)] bg-[color:var(--onboarding-card)] py-0 text-[color:var(--onboarding-text)] shadow-[var(--onboarding-shadow)] sm:max-h-[calc(100vh-4rem)]">
        <CardHeader class="border-b border-[color:var(--onboarding-border)] px-5 py-5 sm:px-8 sm:py-6">
          <div>
            <div>
              <p class="text-[13px] font-semibold text-[color:var(--onboarding-muted)]">{{ progressLabel }}</p>
              <div class="mt-3 flex gap-1.5">
                <span
                  v-for="item in totalSteps"
                  :key="item"
                  class="h-1.5 w-8 rounded-full transition"
                  :class="item <= step ? 'bg-[color:var(--onboarding-accent)]' : 'bg-[color:var(--onboarding-track)]'"
                />
              </div>
            </div>
          </div>

          <h1 class="mt-7 max-w-3xl text-[24px] font-semibold leading-tight tracking-[-0.01em] text-[color:var(--onboarding-text)] sm:text-[28px]">{{ title }}</h1>
          <p v-if="description" class="mt-3 max-w-2xl text-[15px] leading-6 text-[color:var(--onboarding-muted)]">{{ description }}</p>
        </CardHeader>

        <CardContent class="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">
          <slot />
        </CardContent>

        <CardFooter class="flex items-center justify-between border-t border-[color:var(--onboarding-border)] px-5 py-5 sm:px-8">
          <Button
            type="button"
            variant="ghost"
            class="h-10 rounded-xl px-4 text-sm font-semibold text-[color:var(--onboarding-muted)] hover:bg-[color:var(--onboarding-panel-soft)] hover:text-[color:var(--onboarding-text)] focus-visible:ring-[color:var(--onboarding-accent)]"
            :class="showBack ? '' : 'invisible'"
            @click="$emit('back')"
          >
            Back
          </Button>

          <div class="flex items-center gap-3">
            <Button
              v-if="showSkip"
              type="button"
              variant="ghost"
              class="h-10 rounded-xl px-4 text-sm font-semibold text-[color:var(--onboarding-muted)] hover:bg-[color:var(--onboarding-panel-soft)] hover:text-[color:var(--onboarding-text)] focus-visible:ring-[color:var(--onboarding-accent)]"
              @click="$emit('skip')"
            >
              Skip
            </Button>
            <Button
              v-if="showContinue !== false"
              type="button"
              class="h-10 rounded-xl bg-[color:var(--onboarding-accent)] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(124,140,255,0.28)] hover:bg-[color:var(--onboarding-accent-hover)] focus-visible:ring-[color:var(--onboarding-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--onboarding-ring-offset)] disabled:cursor-not-allowed disabled:bg-[color:var(--onboarding-disabled)] disabled:shadow-none"
              :disabled="!canContinue"
              @click="$emit('continue')"
            >
              {{ continueLabel ?? 'Continue' }}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </section>
  </main>
</template>
