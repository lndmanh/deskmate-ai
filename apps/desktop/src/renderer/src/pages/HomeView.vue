<script setup lang="ts">
import { Activity, Bell, ChartColumn, Gauge, Globe, Home, Settings, Timer } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import ActivityDashboard from '@/components/activity/ActivityDashboard.vue'
import ActivitySummaryPopover from '@/components/activity/ActivitySummaryPopover.vue'
import MascotChatBar from '@/components/mascot/MascotChatBar.vue'
import VrmMascot from '@/components/mascot/VrmMascot.vue'
import PomodoroPopover from '@/components/pomodoro/PomodoroPopover.vue'
import SpacePanel from '@/components/spaces/SpacePanel.vue'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useActivityPanels } from '@/composables/useActivityPanels'
import { useSpaces } from '@/composables/useSpaces'

const { selectedSpace, isPanelOpen, togglePanel, volume, isMuted } = useSpaces()
const { isPopoverOpen, isDialogOpen, togglePopover, closeDialog } = useActivityPanels()

const isPomodoroOpen = ref(false)

const videoRef = ref<HTMLIFrameElement | null>(null)

const videoSrc = computed(() => {
  const url = selectedSpace.value?.videoUrl
  if (!url) return null

  // construct new URL and override parameters to enable autoplay and mute
  const newUrl = new URL(url)
  newUrl.searchParams.set('enablejsapi', '1')
  newUrl.searchParams.set('autoplay', '1')
  newUrl.searchParams.set('mute', '1')
  newUrl.searchParams.set('controls', '0')

  return `${newUrl}`
})

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

watch([volume, isMuted, videoSrc], syncVolume)
</script>

<template>
  <main class="relative h-full w-full overflow-hidden">
    <!-- Video background -->
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

    <!-- Floating toolbar -->
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

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :aria-pressed="isPopoverOpen"
              :class="isPopoverOpen ? 'text-primary' : ''"
              aria-label="Activity summary"
              @click="togglePopover"
            >
              <ChartColumn class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Activity summary</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Report" as-child>
              <RouterLink to="/report">
                <Gauge class="size-4" />
              </RouterLink>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Report</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :aria-pressed="isPomodoroOpen"
              :class="isPomodoroOpen ? 'text-primary' : ''"
              aria-label="Pomodoro timer"
              @click="isPomodoroOpen = !isPomodoroOpen"
            >
              <Timer class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pomodoro</TooltipContent>
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
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </TooltipProvider>

    <!-- Spaces panel -->
    <SpacePanel />

    <!-- Draggable Pomodoro timer -->
    <PomodoroPopover v-model="isPomodoroOpen" />

    <!-- Draggable activity summary popover -->
    <ActivitySummaryPopover />

    <!-- Full-screen activity dashboard -->
    <Dialog :open="isDialogOpen" @update:open="(value) => { if (!value) closeDialog() }">
      <DialogContent
        class="flex h-[90vh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90vw]"
      >
        <DialogTitle class="sr-only">Activity Insights</DialogTitle>
        <DialogDescription class="sr-only">
          Statistics, charts, and an AI summary of your computer activity.
        </DialogDescription>
        <ActivityDashboard />
      </DialogContent>
    </Dialog>

    <!-- Mascot -->
    <div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div class="pointer-events-auto h-[100vh] w-[100vw] translate-y-[8vh]">
        <VrmMascot />
      </div>
    </div>

    <!-- Mascot chat -->
    <MascotChatBar />
  </main>
</template>
