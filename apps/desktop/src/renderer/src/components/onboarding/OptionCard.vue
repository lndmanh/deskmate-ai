<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  title: string
  description?: string
  selected?: boolean
  disabled?: boolean
  recommended?: boolean
  compact?: boolean
}

const props = defineProps<Props>()
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    class="group h-auto w-full !whitespace-normal justify-start rounded-[18px] p-0 text-left text-[color:var(--onboarding-text)] hover:bg-transparent focus-visible:ring-[color:var(--onboarding-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--onboarding-ring-offset)] disabled:cursor-not-allowed disabled:opacity-70"
    :class="[compact ? 'min-h-14' : 'min-h-20', selected ? '!bg-[color:var(--onboarding-selected)] shadow-[0_0_0_1px_var(--onboarding-selected-ring)]' : '']"
    :aria-selected="selected"
    :disabled="disabled"
  >
    <Card
      class="w-full rounded-[18px] border-[color:var(--onboarding-border)] bg-[color:var(--onboarding-panel)] py-0 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[color:var(--onboarding-accent-muted)] group-hover:bg-[color:var(--onboarding-panel-hover)]"
      :class="selected ? '!border-[color:var(--onboarding-border-strong)] !bg-[color:var(--onboarding-selected)]' : ''"
    >
      <CardContent class="flex items-start gap-4" :class="props.compact ? 'p-3' : 'p-4'">
        <div
          class="grid shrink-0 place-items-center rounded-2xl bg-[color:var(--onboarding-icon-bg)] text-[color:var(--onboarding-teal)] transition group-hover:text-[color:var(--onboarding-accent)]"
          :class="[props.compact ? 'size-8' : 'size-10', selected ? '!bg-[color:var(--onboarding-accent-soft)] !text-[color:var(--onboarding-text)]' : '']"
        >
          <slot name="icon" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-3">
            <p class="break-words text-[15px] font-semibold leading-5 !text-[color:var(--onboarding-text)]" :class="props.compact ? 'text-sm' : ''">{{ title }}</p>
            <span
              v-if="recommended"
              class="shrink-0 rounded-full border border-[color:var(--onboarding-teal)] bg-[color:var(--onboarding-teal-soft)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--onboarding-teal)]"
            >
              Suggested
            </span>
          </div>
          <p v-if="description" class="mt-1.5 break-words text-sm leading-5 !text-[color:var(--onboarding-muted)]">{{ description }}</p>
        </div>
      </CardContent>
    </Card>
  </Button>
</template>
