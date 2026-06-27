<script setup lang="ts">
// DeskMate wordmark. Switches between white (over the dark hero) and dark
// (once scrolled past the hero), mirroring the logo.svg / logo-dark.svg swap.
defineProps<{ dark?: boolean }>()
</script>

<template>
  <div class="flex items-center gap-2 h-8 transition-colors">
    <span
      class="grid h-8 w-8 place-items-center rounded-lg transition-colors"
      :class="dark ? 'bg-foreground text-background' : 'bg-white text-foreground'"
    >
      <!-- activity / heartbeat mark -->
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 12h4l2 5 4-12 2 7h6" />
      </svg>
    </span>
    <span
      class="text-lg font-semibold tracking-tight transition-colors"
      :class="dark ? 'text-foreground' : 'text-white'"
    >
      DeskMate<span class="opacity-60"> AI</span>
    </span>
  </div>
</template>
