<script setup lang="ts">
import { Menu } from '@lucide/vue'
import LandingLogo from '@/components/LandingLogo.vue'

// `dark` becomes true once the user scrolls past the dark hero.
defineProps<{ dark?: boolean }>()

const items = ['Home', 'Modules', 'Reports', 'Privacy']
</script>

<template>
  <header class="fixed top-6 left-0 right-0 z-50 px-8 flex items-center justify-between">
    <LandingLogo :dark="dark" />

    <nav
      class="flex items-center gap-1 text-white rounded-full pl-2 pr-2 py-2 backdrop-blur-md"
      style="background: var(--header-bg)"
    >
      <a
        v-for="(item, i) in items"
        :key="item"
        href="#"
        class="px-5 py-2 text-sm rounded-full transition"
        :class="i === 0 ? 'bg-white/10 font-medium' : 'opacity-80 hover:opacity-100'"
      >
        {{ item }}
      </a>
      <button
        class="ml-2 flex items-center gap-2 px-4 py-2 text-sm rounded-full hover:bg-white/10 transition"
      >
        <Menu class="w-4 h-4" />
        Menu
      </button>
    </nav>
  </header>
</template>
