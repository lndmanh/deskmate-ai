<script setup lang="ts">
import type { Component } from 'vue'
import {
  Activity,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  CreditCard,
  Database,
  Gift,
  Globe,
  Home,
  LifeBuoy,
  Link,
  Mic,
  MonitorCog,
  Moon,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserRound
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import ActivityDashboard from '@/components/activity/ActivityDashboard.vue'
import ActivitySummaryPopover from '@/components/activity/ActivitySummaryPopover.vue'
import MascotChatBar from '@/components/mascot/MascotChatBar.vue'
import VrmMascot from '@/components/mascot/VrmMascot.vue'
import PomodoroPopover from '@/components/pomodoro/PomodoroPopover.vue'
import SpacePanel from '@/components/spaces/SpacePanel.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useActivityPanels } from '@/composables/useActivityPanels'
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
const { isPopoverOpen, isDialogOpen, togglePopover, closeDialog } = useActivityPanels()

const settingsOpen = ref(false)
const themePreference = ref<ThemePreference>('system')
const systemThemeMode = ref<ThemeMode>(getSystemThemeMode())
const settingSearch = ref('')
let removeSystemThemeListener: (() => void) | undefined

type SettingPageId =
  | 'account'
  | 'security'
  | 'privacy'
  | 'notifications'
  | 'appearance'
  | 'voice'
  | 'integrations'
  | 'billing'
  | 'advanced'
  | 'gifts'
  | 'support'

type SettingNavItem = {
  id: SettingPageId
  label: string
  icon: Component
  badge?: string
}

type SettingNavGroup = {
  label: string
  items: SettingNavItem[]
}

type SettingRow = {
  label: string
  value?: string
  description?: string
  action?: string
  enabled?: boolean
  tone?: 'default' | 'success' | 'warning'
}

type SettingSection = {
  title: string
  description?: string
  rows: SettingRow[]
}

type SettingContent = {
  title: string
  description: string
  sections: SettingSection[]
}

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

const settingGroups: SettingNavGroup[] = [
  {
    label: 'Account',
    items: [
      { id: 'account', label: 'Account Profile', icon: UserRound },
      { id: 'security', label: 'Password & Security', icon: ShieldCheck },
      { id: 'privacy', label: 'Data & Privacy', icon: Database },
      { id: 'notifications', label: 'Notifications', icon: BellRing }
    ]
  },
  {
    label: 'Workspace',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Palette, badge: 'Live' },
      { id: 'voice', label: 'Voice & Video', icon: Mic },
      { id: 'integrations', label: 'Connections', icon: Link },
      { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal }
    ]
  },
  {
    label: 'Plan',
    items: [
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'support', label: 'Support', icon: LifeBuoy },
      { id: 'gifts', label: 'Gift Inventory', icon: Gift, badge: 'Mock' }
    ]
  }
]

const settingContent: Record<SettingPageId, SettingContent> = {
  account: {
    title: 'Account Profile',
    description: 'Mock account information for the local DeskMate workspace.',
    sections: [
      {
        title: 'Profile',
        rows: [
          { label: 'Display name', value: 'DeskMate Builder', action: 'Edit' },
          { label: 'Username', value: 'deskmate_local', action: 'Edit' },
          { label: 'Email', value: '********@gmail.com', action: 'Reveal' },
          { label: 'Phone', value: '*******5641', action: 'Edit' }
        ]
      },
      {
        title: 'Account Status',
        rows: [
          {
            label: 'Workspace health',
            value: 'Good standing',
            description: 'Your local setup has no account restrictions.',
            tone: 'success'
          },
          { label: 'Onboarding data', value: 'Saved locally', description: 'Answers are stored in onboarding.json on this device.' }
        ]
      }
    ]
  },
  security: {
    title: 'Password & Security',
    description: 'Mock security controls for future account protection.',
    sections: [
      {
        title: 'Sign-in',
        rows: [
          { label: 'Password', value: 'Last changed recently', action: 'Change' },
          { label: 'Two-factor authentication', value: 'Not configured', action: 'Set up', tone: 'warning' },
          { label: 'Trusted devices', value: '2 devices', action: 'Manage' }
        ]
      },
      {
        title: 'Session Safety',
        rows: [
          { label: 'Require unlock after idle', enabled: true, description: 'Ask for confirmation after long idle periods.' },
          { label: 'Notify on new device', enabled: true, description: 'Show a local alert when a new sign-in is detected.' }
        ]
      }
    ]
  },
  privacy: {
    title: 'Data & Privacy',
    description: 'Local-first controls for what DeskMate can observe and store.',
    sections: [
      {
        title: 'Local Data',
        rows: [
          { label: 'Onboarding answers', value: 'Local JSON', action: 'View path' },
          { label: 'Activity history', value: 'This device only', action: 'Manage' },
          { label: 'Cloud sync', value: 'Off', action: 'Configure' }
        ]
      },
      {
        title: 'Privacy Defaults',
        rows: [
          { label: 'No employer monitoring', enabled: true },
          { label: 'Camera frames are not stored', enabled: true },
          { label: 'Ask before enabling sensitive modules', enabled: true }
        ]
      }
    ]
  },
  notifications: {
    title: 'Notifications',
    description: 'Mock notification preferences for reminders and status updates.',
    sections: [
      {
        title: 'Reminders',
        rows: [
          { label: 'Break reminders', enabled: true, description: 'Nudge me after long focus sessions.' },
          { label: 'Posture prompts', enabled: true, description: 'Show gentle posture check-ins.' },
          { label: 'Meeting fatigue alerts', enabled: false, description: 'Warn me after meeting-heavy blocks.' }
        ]
      },
      {
        title: 'Delivery',
        rows: [
          { label: 'Desktop notifications', value: 'Enabled', action: 'Preview' },
          { label: 'Quiet hours', value: '10:00 PM - 7:00 AM', action: 'Edit' }
        ]
      }
    ]
  },
  appearance: {
    title: 'Appearance',
    description: 'Choose how DeskMate AI looks on this device.',
    sections: [
      {
        title: 'Density',
        rows: [
          { label: 'Interface density', value: 'Comfortable', action: 'Change' },
          { label: 'Reduce motion', enabled: false },
          { label: 'Show ambient space video', enabled: true }
        ]
      }
    ]
  },
  voice: {
    title: 'Voice & Video',
    description: 'Mock device preferences for future camera and voice modules.',
    sections: [
      {
        title: 'Input Devices',
        rows: [
          { label: 'Microphone', value: 'Default input', action: 'Test' },
          { label: 'Camera', value: 'Ask before use', action: 'Configure' },
          { label: 'Noise suppression', enabled: true }
        ]
      },
      {
        title: 'Posture Camera',
        rows: [
          { label: 'Process locally', enabled: true },
          { label: 'Save raw frames', enabled: false },
          { label: 'Calibration profile', value: 'Desk setup', action: 'Update' }
        ]
      }
    ]
  },
  integrations: {
    title: 'Connections',
    description: 'Mock connections for tools DeskMate may integrate with later.',
    sections: [
      {
        title: 'Connected Apps',
        rows: [
          { label: 'Calendar', value: 'Not connected', action: 'Connect' },
          { label: 'Slack', value: 'Not connected', action: 'Connect' },
          { label: 'Notion', value: 'Mock connected', action: 'Manage', tone: 'success' }
        ]
      },
      {
        title: 'Developer',
        rows: [
          { label: 'Local API bridge', enabled: false },
          { label: 'Webhook events', value: '0 active', action: 'Add' }
        ]
      }
    ]
  },
  billing: {
    title: 'Billing',
    description: 'Mock billing area for future subscription and invoices.',
    sections: [
      {
        title: 'Plan',
        rows: [
          { label: 'Current plan', value: 'Local Preview', action: 'Upgrade' },
          { label: 'Trial status', value: '14 days remaining', tone: 'success' },
          { label: 'Payment method', value: 'None', action: 'Add' }
        ]
      },
      {
        title: 'Invoices',
        rows: [
          { label: 'June 2026', value: '$0.00', action: 'Download' },
          { label: 'May 2026', value: '$0.00', action: 'Download' }
        ]
      }
    ]
  },
  advanced: {
    title: 'Advanced',
    description: 'Mock advanced controls for diagnostics and local data handling.',
    sections: [
      {
        title: 'Diagnostics',
        rows: [
          { label: 'Debug overlay', enabled: false },
          { label: 'Verbose local logs', enabled: false },
          { label: 'Export diagnostic bundle', value: 'Ready', action: 'Export' }
        ]
      },
      {
        title: 'Storage',
        rows: [
          { label: 'Clear onboarding data', value: 'Resets first-run flow', action: 'Clear' },
          { label: 'Reset all settings', value: 'Keeps local activity history', action: 'Reset' }
        ]
      }
    ]
  },
  support: {
    title: 'Support',
    description: 'Mock support and help center resources.',
    sections: [
      {
        title: 'Help',
        rows: [
          { label: 'Documentation', value: 'Local guide', action: 'Open' },
          { label: 'Keyboard shortcuts', value: '12 shortcuts', action: 'View' },
          { label: 'Contact support', value: 'Mock channel', action: 'Start' }
        ]
      },
      {
        title: 'About',
        rows: [
          { label: 'DeskMate AI', value: 'Preview build' },
          { label: 'Runtime', value: 'Electron desktop' }
        ]
      }
    ]
  },
  gifts: {
    title: 'Gift Inventory',
    description: 'Mock reward inventory for future perks and workspace boosts.',
    sections: [
      {
        title: 'Available Gifts',
        rows: [
          { label: 'Focus Boost', value: '2 available', action: 'Use' },
          { label: 'Theme Token', value: '1 available', action: 'Redeem' },
          { label: 'Weekend Builder Badge', value: 'Unlocked', tone: 'success' }
        ]
      },
      {
        title: 'History',
        rows: [
          { label: 'June reward drop', value: 'Claimed' },
          { label: 'Early preview gift', value: 'Claimed' }
        ]
      }
    ]
  }
}

const selectedSetting = ref<SettingPageId>('account')
const selectedSettingContent = computed(() => settingContent[selectedSetting.value])
const filteredSettingGroups = computed(() => {
  const searchTerm = settingSearch.value.trim().toLowerCase()
  if (!searchTerm) return settingGroups

  return settingGroups
    .map((group) => ({
      label: group.label,
      items: group.items.filter((item) =>
        `${group.label} ${item.label}`.toLowerCase().includes(searchTerm)
      )
    }))
    .filter((group) => group.items.length > 0)
})
const activeThemeMode = computed(() => resolveThemePreference(themePreference.value, systemThemeMode.value))

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
            <Button variant="ghost" size="icon" aria-label="Settings" @click="settingsOpen = true">
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

    <Dialog v-model:open="settingsOpen">
      <DialogContent class="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[1040px]">
        <div class="grid max-h-[calc(100vh-2rem)] min-h-[640px] md:grid-cols-[282px_minmax(0,1fr)]">
          <aside class="min-h-0 border-b bg-muted/40 md:border-r md:border-b-0">
            <div class="flex h-full min-h-0 flex-col p-4">
              <div class="flex items-center gap-3 rounded-md px-2 py-3">
                <div class="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <MonitorCog class="size-5" />
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold">DeskMate AI</p>
                  <p class="truncate text-xs text-muted-foreground">Local workspace settings</p>
                </div>
              </div>

              <div class="relative mt-4">
                <Search
                  class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input v-model="settingSearch" placeholder="Search settings" class="h-9 pl-8" />
              </div>

              <Separator class="my-4" />

              <ScrollArea class="min-h-0 flex-1 pr-3">
                <nav class="space-y-5">
                  <div v-for="group in filteredSettingGroups" :key="group.label" class="space-y-1">
                    <p class="px-2 pb-1 text-xs font-medium uppercase text-muted-foreground">
                      {{ group.label }}
                    </p>
                    <button
                      v-for="item in group.items"
                      :key="item.id"
                      type="button"
                      class="flex h-9 w-full min-w-0 items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      :class="
                        selectedSetting === item.id
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground'
                      "
                      :aria-current="selectedSetting === item.id ? 'page' : undefined"
                      @click="selectedSetting = item.id"
                    >
                      <component :is="item.icon" class="size-4 shrink-0" />
                      <span class="truncate">{{ item.label }}</span>
                      <Badge v-if="item.badge" variant="secondary" class="ml-auto h-5 shrink-0 px-1.5 text-[10px]">
                        {{ item.badge }}
                      </Badge>
                    </button>
                  </div>

                  <p
                    v-if="filteredSettingGroups.length === 0"
                    class="px-2 py-6 text-center text-sm text-muted-foreground"
                  >
                    No settings found.
                  </p>
                </nav>
              </ScrollArea>
            </div>
          </aside>

          <section class="min-w-0 overflow-hidden">
            <ScrollArea class="h-[640px] max-h-[calc(100vh-2rem)]">
              <div class="px-5 py-6 sm:px-8">
                <DialogHeader>
                  <DialogTitle class="text-2xl">{{ selectedSettingContent.title }}</DialogTitle>
                  <DialogDescription>
                    {{ selectedSettingContent.description }}
                  </DialogDescription>
                </DialogHeader>

                <section v-if="selectedSetting === 'appearance'" class="mt-8">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 class="text-sm font-semibold">Theme</h2>
                      <p class="mt-1 text-sm text-muted-foreground">
                        Follow Ubuntu/system mode, or choose a fixed app mode.
                      </p>
                    </div>
                    <Badge variant="outline" class="w-fit gap-1.5">
                      <MonitorCog class="size-3.5" />
                      Active {{ activeThemeMode }} mode
                    </Badge>
                  </div>

                  <div class="mt-4 grid gap-3 lg:grid-cols-3">
                    <button
                      v-for="option in themeOptions"
                      :key="option.value"
                      type="button"
                      class="group rounded-lg border p-4 text-left transition hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      :class="
                        themePreference === option.value
                          ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                          : 'bg-card text-card-foreground'
                      "
                      @click="setTheme(option.value)"
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex min-w-0 items-start gap-3">
                          <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-background">
                            <component :is="option.icon" class="size-4" />
                          </span>
                          <span class="min-w-0">
                            <span class="block text-sm font-semibold">{{ option.label }}</span>
                            <span class="mt-1 block text-sm leading-5 text-muted-foreground">
                              {{ option.description }}
                            </span>
                          </span>
                        </div>
                        <Check v-if="themePreference === option.value" class="size-5 shrink-0 text-primary" />
                      </div>
                    </button>
                  </div>
                </section>

                <div class="mt-8 space-y-8">
                  <section v-for="settingSection in selectedSettingContent.sections" :key="settingSection.title">
                    <div class="mb-3">
                      <h2 class="text-lg font-semibold">{{ settingSection.title }}</h2>
                      <p v-if="settingSection.description" class="mt-1 text-sm text-muted-foreground">
                        {{ settingSection.description }}
                      </p>
                    </div>

                    <div class="overflow-hidden rounded-lg border bg-card">
                      <div
                        v-for="row in settingSection.rows"
                        :key="row.label"
                        class="flex flex-col gap-3 border-b px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div class="min-w-0">
                          <p class="text-sm font-medium text-card-foreground">{{ row.label }}</p>
                          <p v-if="row.description" class="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
                            {{ row.description }}
                          </p>
                        </div>

                        <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                          <Switch
                            v-if="row.enabled !== undefined"
                            :model-value="row.enabled"
                            :aria-label="row.label"
                            disabled
                          />
                          <span
                            v-if="row.value"
                            class="max-w-[220px] truncate text-sm"
                            :class="
                              row.tone === 'success'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : row.tone === 'warning'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-muted-foreground'
                            "
                          >
                            {{ row.value }}
                          </span>
                          <Button v-if="row.action" variant="outline" size="sm" class="h-8 gap-1">
                            {{ row.action }}
                            <ChevronRight class="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </ScrollArea>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  </main>
</template>