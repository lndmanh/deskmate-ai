<script setup lang="ts">
import {
  Activity,
  ChartColumn,
  ChartPie,
  Clock,
  Gauge,
  Hourglass,
  Layers,
  LayoutDashboard,
  Loader2,
  MoonStar,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Sparkles,
  TrendingUp
} from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import VChart from 'vue-echarts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { useActivityData } from '@/composables/useActivityData'
import {
  categoryDonutOption,
  hourlyFocusOption,
  readChartTheme,
  topAppsBarOption,
  trendOption
} from '@/lib/activity-charts'
import {
  categoryBreakdown,
  formatDuration,
  formatShortDate,
  hasActivity,
  hourlyActiveMinutes,
  summarize,
  topApps
} from '@/lib/activity-insights'
import {
  generateActivitySummary,
  type ActivitySummary
} from '@/lib/activity-summary-client'
import { ensureEcharts } from '@/lib/echarts'

ensureEcharts()

const {
  status,
  today,
  viewedDay,
  selectedDate,
  dayOptions,
  trend,
  trendLoading,
  isTracking,
  loading,
  errorMessage,
  viewDay,
  refresh,
  loadTrend,
  startTracking,
  stopTracking
} = useActivityData()

const day = computed(() => viewedDay.value ?? today.value)
const stats = computed(() => summarize(day.value))
const slices = computed(() => categoryBreakdown(day.value))
const apps = computed(() => topApps(day.value, 8))
const hourly = computed(() => hourlyActiveMinutes(day.value))
const hasData = computed(() => hasActivity(day.value))
const isToday = computed(() => Boolean(day.value && status.value && day.value.date === status.value.date))

// Theme is read from CSS vars on open so charts match the active light/dark theme.
const theme = ref(readChartTheme())
const categoryOption = computed(() => categoryDonutOption(slices.value, theme.value))
const appsOption = computed(() => topAppsBarOption(apps.value, theme.value))
const hourlyOption = computed(() => hourlyFocusOption(hourly.value, theme.value))
const trendChartOption = computed(() => trendOption(trend.value, theme.value))

const selectedDayModel = computed({
  get: () => selectedDate.value,
  set: (value: string) => {
    void viewDay(value).then(() => regenerate())
  }
})

// --- LLM summary ----------------------------------------------------------
const summary = ref<ActivitySummary | null>(null)
const summaryLoading = ref(false)
let summaryToken = 0

async function regenerate(): Promise<void> {
  if (!day.value || !hasData.value) {
    summary.value = null
    return
  }
  const token = ++summaryToken
  summaryLoading.value = true
  try {
    const result = await generateActivitySummary(day.value, trend.value)
    if (token === summaryToken) summary.value = result
  } finally {
    if (token === summaryToken) summaryLoading.value = false
  }
}

const summarySourceLabel = computed(() => {
  if (!summary.value) return ''
  return summary.value.source === 'llm' ? `AI · ${summary.value.model}` : 'On-device'
})

async function onRefresh(): Promise<void> {
  await refresh()
  await loadTrend()
  await regenerate()
}

async function onToggleTracking(): Promise<void> {
  if (isTracking.value) await stopTracking()
  else await startTracking()
}

onMounted(async () => {
  theme.value = readChartTheme()
  if (!day.value) await refresh()
  await loadTrend()
  await regenerate()
})
</script>

<template>
  <div class="flex h-full flex-col bg-background text-foreground">
    <!-- Header -->
    <header class="flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-4 pr-14">
      <div class="flex items-center gap-2.5">
        <span class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LayoutDashboard class="size-5" />
        </span>
        <div>
          <h2 class="text-lg leading-tight font-semibold tracking-tight">Activity Insights</h2>
          <p class="text-xs text-muted-foreground">
            {{ stats.date ? formatShortDate(stats.date) : 'Your work rhythm' }}
            <span v-if="isToday"> · live</span>
          </p>
        </div>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <NativeSelect v-model="selectedDayModel" class="h-8 w-40 text-sm">
          <option v-for="date in dayOptions" :key="date" :value="date">
            {{ formatShortDate(date) }}{{ date === today?.date ? ' (today)' : '' }}
          </option>
        </NativeSelect>
        <Badge :variant="isTracking ? 'success' : 'secondary'">
          {{ isTracking ? 'Tracking' : 'Paused' }}
        </Badge>
        <Button size="sm" variant="outline" @click="onToggleTracking">
          <component :is="isTracking ? Pause : Play" class="size-4" />
          {{ isTracking ? 'Stop' : 'Start' }}
        </Button>
        <Button size="icon-sm" variant="ghost" :disabled="loading" aria-label="Refresh" @click="onRefresh">
          <RefreshCw class="size-4" :class="loading ? 'animate-spin' : ''" />
        </Button>
      </div>

      <p v-if="errorMessage" class="w-full text-xs text-destructive">{{ errorMessage }}</p>
    </header>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto">
      <!-- Empty state -->
      <div v-if="!hasData" class="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
        <span class="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Activity class="size-7" />
        </span>
        <div class="max-w-md space-y-1">
          <p class="text-base font-medium">No activity for this day yet</p>
          <p class="text-sm text-muted-foreground">
            DeskMate tracks which apps you focus on and turns it into insights about your focus,
            balance, and rhythm. Start tracking to fill this in.
          </p>
        </div>
        <Button v-if="!isTracking" @click="onToggleTracking">
          <Play class="size-4" /> Start tracking
        </Button>
      </div>

      <div v-else class="space-y-5 p-6">
        <!-- Stat cards -->
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Card class="gap-1.5 p-4">
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock class="size-3.5" /> Focused time</span>
            <span class="text-xl font-semibold tracking-tight">{{ formatDuration(stats.activeMs) }}</span>
          </Card>
          <Card class="gap-1.5 p-4">
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground"><Gauge class="size-3.5" /> Focus ratio</span>
            <span class="text-xl font-semibold tracking-tight">{{ Math.round(stats.focusRatio * 100) }}%</span>
          </Card>
          <Card class="gap-1.5 p-4">
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground"><Layers class="size-3.5" /> Work sessions</span>
            <span class="text-xl font-semibold tracking-tight">{{ stats.sessionCount }}</span>
          </Card>
          <Card class="gap-1.5 p-4">
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground"><Hourglass class="size-3.5" /> Longest session</span>
            <span class="text-xl font-semibold tracking-tight">{{ formatDuration(stats.longestSessionMs) }}</span>
          </Card>
          <Card class="gap-1.5 p-4">
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground"><Shuffle class="size-3.5" /> Context switches</span>
            <span class="text-xl font-semibold tracking-tight">{{ stats.contextSwitches }}</span>
          </Card>
          <Card class="gap-1.5 p-4">
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground"><MoonStar class="size-3.5" /> Late-night</span>
            <span class="text-xl font-semibold tracking-tight">{{ formatDuration(stats.lateNightMs) }}</span>
          </Card>
        </div>

        <!-- LLM summary -->
        <Card class="gap-3 p-5">
          <div class="flex items-center gap-2">
            <Sparkles class="size-4 text-primary" />
            <h3 class="text-sm font-semibold">DeskMate summary</h3>
            <Badge v-if="summary" variant="outline" class="ml-1">{{ summarySourceLabel }}</Badge>
            <Button
              size="sm"
              variant="ghost"
              class="ml-auto"
              :disabled="summaryLoading"
              @click="regenerate"
            >
              <RefreshCw class="size-3.5" :class="summaryLoading ? 'animate-spin' : ''" />
              Regenerate
            </Button>
          </div>
          <div v-if="summaryLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" /> Generating your recap…
          </div>
          <template v-else>
            <p class="text-sm leading-relaxed text-foreground/90">
              {{ summary?.text }}
            </p>
            <p v-if="summary?.error" class="text-xs text-muted-foreground">
              Showing an on-device summary — the AI request didn't go through.
            </p>
          </template>
        </Card>

        <!-- Charts: category + apps -->
        <div class="grid gap-4 lg:grid-cols-2">
          <Card class="gap-3 p-5">
            <div class="flex items-center gap-2">
              <ChartPie class="size-4 text-muted-foreground" />
              <h3 class="text-sm font-semibold">Time by category</h3>
            </div>
            <div class="h-72 w-full">
              <VChart :option="categoryOption" autoresize class="h-full w-full" />
            </div>
          </Card>

          <Card class="gap-3 p-5">
            <div class="flex items-center gap-2">
              <ChartColumn class="size-4 text-muted-foreground" />
              <h3 class="text-sm font-semibold">Top applications</h3>
            </div>
            <div class="h-72 w-full">
              <VChart :option="appsOption" autoresize class="h-full w-full" />
            </div>
          </Card>
        </div>

        <!-- Focus through the day -->
        <Card class="gap-3 p-5">
          <div class="flex items-center gap-2">
            <Clock class="size-4 text-muted-foreground" />
            <h3 class="text-sm font-semibold">Focus through the day</h3>
            <span class="text-xs text-muted-foreground">· shaded = late night</span>
          </div>
          <div class="h-64 w-full">
            <VChart :option="hourlyOption" autoresize class="h-full w-full" />
          </div>
        </Card>

        <!-- Multi-day trend -->
        <Card class="gap-3 p-5">
          <div class="flex items-center gap-2">
            <TrendingUp class="size-4 text-muted-foreground" />
            <h3 class="text-sm font-semibold">Daily focus trend</h3>
            <Loader2 v-if="trendLoading" class="size-3.5 animate-spin text-muted-foreground" />
          </div>
          <div v-if="trend.length >= 2" class="h-64 w-full">
            <VChart :option="trendChartOption" autoresize class="h-full w-full" />
          </div>
          <p v-else class="py-10 text-center text-sm text-muted-foreground">
            Track a few more days and your focus trend will appear here.
          </p>
        </Card>
      </div>
    </div>
  </div>
</template>
