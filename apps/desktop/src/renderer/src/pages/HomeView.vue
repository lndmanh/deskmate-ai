<script setup lang="ts">
import type { Component } from 'vue'
import { Activity, Bell, Check, Globe, Home, MonitorCog, Moon, Settings, Sun } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import VrmMascot from '@/components/mascot/VrmMascot.vue'
import SpacePanel from '@/components/spaces/SpacePanel.vue'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useSpaces } from '@/composables/useSpaces'
import {
  applyThemeMode,
  getSystemThemeMode,
  readThemePreference,
  resolveThemePreference,
  watchSystemThemeChange,
  writeThemePreference,
  type ThemeMode,
  type ThemePreference
} from '@/lib/theme'

const { selectedSpace, isPanelOpen, togglePanel, volume, isMuted } = useSpaces()

const settingsOpen = ref(false)
const themePreference = ref<ThemePreference>('system')
const systemThemeMode = ref<ThemeMode>(getSystemThemeMode())
let removeSystemThemeListener: (() => void) | undefined

const themeOptions: Array<{
  value: ThemePreference
  label: string
  description: string
  icon: Component
}> = [
  {
    value: 'system',
    label: 'System',
    description: 'Follow Ubuntu or your system appearance setting.',
    icon: MonitorCog
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low-glare workspace for long sessions.',
    icon: Moon
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Brighter workspace for daytime use.',
    icon: Sun
  }
]

const activeThemeMode = computed(() => resolveThemePreference(themePreference.value, systemThemeMode.value))

const videoRef = ref<HTMLIFrameElement | null>(null)

const videoSrc = computed(() => {
  const url = selectedSpace.value?.videoUrl
  if (!url) return null

  const newUrl = new URL(url)
  newUrl.searchParams.set('enablejsapi', '1')
  newUrl.searchParams.set('autoplay', '1')
  newUrl.searchParams.set('mute', '1')
  newUrl.searchParams.set('controls', '0')

  return `${newUrl}`
})

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

watch(themePreference, (preference) => {
  writeThemePreference(preference)
})

watch(
  activeThemeMode,
  (mode) => {
    applyThemeMode(mode)
  },
  { immediate: true }
)

watch([volume, isMuted, videoSrc], syncVolume)

function setTheme(preference: ThemePreference): void {
  themePreference.value = preference
}

function postToPlayer(func: string, args: number[] = []): void {
  videoRef.value?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*'
  )
}

function syncVolume(): void {
  if (isMuted.value || volume.value === 0) {
    postToPlayer('mute')
    return
  }
  postToPlayer('unMute')
  postToPlayer('setVolume', [volume.value])
}
</script>

<template>
  <main class="relative h-full w-full overflow-hidden bg-background text-foreground">
    <div class="absolute inset-0 -z-10 overflow-hidden bg-background">
      <iframe
        v-if="videoSrc"
        ref="videoRef"
        :key="videoSrc"
        :src="videoSrc"
        title="Space background"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        class="pointer-events-none absolute top-1/2 left-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
        @load="syncVolume"
      />
      <div v-if="videoSrc" class="absolute inset-0 bg-black/20" />
    </div>

    <TooltipProvider :delay-duration="200">
      <ButtonGroup
        class="bg-background/80 supports-backdrop-filter:bg-background/60 fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border p-1 shadow-lg backdrop-blur"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Home">
              <Home class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Home</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :aria-pressed="isPanelOpen"
              :class="isPanelOpen ? 'text-primary' : ''"
              aria-label="Spaces"
              @click="togglePanel"
            >
              <Globe class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Spaces</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Activity" as-child>
              <RouterLink to="/activity-test">
                <Activity class="size-4" />
              </RouterLink>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Activity</TooltipContent>
        </Tooltip>

        <ButtonGroupSeparator />

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Settings" @click="settingsOpen = true">
              <Settings class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </TooltipProvider>

    <SpacePanel />

    <div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div class="pointer-events-auto h-[100vh] w-[100vw] translate-y-[8vh]">
        <VrmMascot />
      </div>
    </div>

    <Dialog v-model:open="settingsOpen">
      <DialogContent class="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[860px]">
        <div class="grid min-h-[560px] md:grid-cols-[240px_1fr]">
          <aside class="border-b bg-muted/40 p-4 md:border-r md:border-b-0">
            <div class="flex items-center gap-3 rounded-md px-2 py-3">
              <div class="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <MonitorCog class="size-5" />
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">DeskMate AI</p>
                <p class="text-xs text-muted-foreground">Preferences</p>
              </div>
            </div>

            <div class="mt-5 space-y-1">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-md bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground"
              >
                <MonitorCog class="size-4" />
                Appearance
              </button>
            </div>
          </aside>

          <section class="overflow-y-auto p-5 sm:p-7">
            <DialogHeader>
              <DialogTitle class="text-xl">Appearance</DialogTitle>
              <DialogDescription>
                Choose how DeskMate AI looks on this device.
              </DialogDescription>
            </DialogHeader>

            <div class="mt-8">
              <h2 class="text-sm font-semibold">Theme</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                Follow Ubuntu/system mode, or choose a fixed app mode.
              </p>

              <div class="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  v-for="option in themeOptions"
                  :key="option.value"
                  type="button"
                  class="group rounded-lg border p-4 text-left transition hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  :class="themePreference === option.value ? 'border-primary bg-accent text-accent-foreground' : 'bg-card'"
                  @click="setTheme(option.value)"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex items-center gap-3">
                      <span class="flex size-9 items-center justify-center rounded-md bg-background">
                        <component :is="option.icon" class="size-4" />
                      </span>
                      <span>
                        <span class="block text-sm font-semibold">{{ option.label }}</span>
                        <span class="mt-1 block text-sm text-muted-foreground">{{ option.description }}</span>
                      </span>
                    </div>
                    <Check v-if="themePreference === option.value" class="size-5 text-primary" />
                  </div>
                </button>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  </main>
</template>
