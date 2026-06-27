// Shared, app-wide access to the activity tracker data.
//
// State lives at module scope so the summary popover and the dashboard dialog
// read from one source and stay in sync with live tracker updates. The bridge
// subscription is set up once, on first use.
import { computed, ref } from 'vue'

import type { DailyUsage, TrackerStatus, TrendPoint } from '@/lib/activity-insights'

const status = ref<TrackerStatus | null>(null)
const today = ref<DailyUsage | null>(null)
const days = ref<string[]>([])
const selectedDate = ref('')
const viewedDay = ref<DailyUsage | null>(null)
const trend = ref<TrendPoint[]>([])

const loading = ref(false)
const trendLoading = ref(false)
const errorMessage = ref('')

let initialised = false

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected activity tracker error'
}

async function loadStatusAndToday(): Promise<void> {
  status.value = await window.api.activity.status()
  today.value = await window.api.activity.getToday()
}

async function loadDays(): Promise<void> {
  days.value = await window.api.activity.listDays()
}

/** Load a specific day into the dashboard's "viewed day" slot. */
async function viewDay(date: string): Promise<void> {
  if (!date) return
  loading.value = true
  errorMessage.value = ''
  try {
    selectedDate.value = date
    viewedDay.value =
      today.value && date === today.value.date
        ? today.value
        : await window.api.activity.getDay(date)
  } catch (error) {
    errorMessage.value = toMessage(error)
  } finally {
    loading.value = false
  }
}

async function refresh(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    await loadStatusAndToday()
    await loadDays()
    const date = selectedDate.value || status.value?.date || today.value?.date || ''
    if (date) await viewDay(date)
  } catch (error) {
    errorMessage.value = toMessage(error)
  } finally {
    loading.value = false
  }
}

/** Build the recent multi-day trend (one rollup read per day, today reused). */
async function loadTrend(daysBack = 14): Promise<void> {
  trendLoading.value = true
  try {
    await loadDays()
    const unique = new Set(days.value)
    if (status.value?.date) unique.add(status.value.date)
    if (today.value?.date) unique.add(today.value.date)
    const dates = [...unique].sort((a, b) => a.localeCompare(b)).slice(-daysBack)

    const points: TrendPoint[] = []
    for (const date of dates) {
      const day =
        today.value && date === today.value.date
          ? today.value
          : await window.api.activity.getDay(date)
      points.push({
        date,
        activeMs: day?.activeMs ?? 0,
        lateNightMs: day?.lateNightMs ?? 0
      })
    }
    trend.value = points
  } catch (error) {
    errorMessage.value = toMessage(error)
  } finally {
    trendLoading.value = false
  }
}

async function startTracking(): Promise<void> {
  status.value = await window.api.activity.start()
  await refresh()
}

async function stopTracking(): Promise<void> {
  status.value = await window.api.activity.stop()
  await loadStatusAndToday()
}

function init(): void {
  if (initialised) return
  initialised = true

  // The activity bridge is injected by Electron's preload. If it is missing
  // (preload failed to load, or the renderer is running outside Electron) we
  // must NOT throw here: this runs synchronously inside component setup, so an
  // exception would tear down the whole page (toolbar, mascot, etc.) instead of
  // just leaving the activity panels empty.
  const activityBridge = window.api?.activity
  if (!activityBridge) {
    errorMessage.value = 'Activity tracker is unavailable.'
    return
  }

  try {
    // Live status pushes; refresh today (and the viewed day if it is today).
    activityBridge.onUpdate((next) => {
      status.value = next
      if (!next.running) return
      void activityBridge.getToday().then((rollup) => {
        today.value = rollup
        if (selectedDate.value === rollup.date) viewedDay.value = rollup
      })
    })
  } catch (error) {
    errorMessage.value = toMessage(error)
    return
  }

  void refresh()
}

/** Day options for selectors — stored days plus today, newest first. */
const dayOptions = computed(() => {
  const unique = new Set(days.value)
  if (status.value?.date) unique.add(status.value.date)
  if (today.value?.date) unique.add(today.value.date)
  return [...unique].sort((a, b) => b.localeCompare(a))
})

const isTracking = computed(() => Boolean(status.value?.running))

export function useActivityData() {
  init()
  return {
    // state
    status,
    today,
    days,
    dayOptions,
    selectedDate,
    viewedDay,
    trend,
    loading,
    trendLoading,
    errorMessage,
    isTracking,
    // actions
    refresh,
    viewDay,
    loadTrend,
    startTracking,
    stopTracking
  }
}
