<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'

type ActivityStatus = Awaited<ReturnType<typeof window.api.activity.status>>
type DailyActivity = Awaited<ReturnType<typeof window.api.activity.getToday>>
type ActivityEvent = Parameters<Parameters<typeof window.api.activity.onEvent>[0]>[0]
type BackfillResult = Awaited<ReturnType<typeof window.api.activity.backfill>>

const status = ref<ActivityStatus | null>(null)
const today = ref<DailyActivity | null>(null)
const liveEvents = ref<ActivityEvent[]>([])
const errorMessage = ref('')
const loading = ref(false)

const days = ref<string[]>([])
const selectedDate = ref('')
const backfillSupported = ref(false)
const backfilling = ref(false)
const backfillResult = ref<BackfillResult | null>(null)

let unsubscribeUpdate: (() => void) | null = null
let unsubscribeEvent: (() => void) | null = null

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes}m ${seconds}s`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString()
}

function setError(error: unknown): void {
  errorMessage.value = error instanceof Error ? error.message : 'Unexpected activity tracker error'
}

async function loadDays(): Promise<void> {
  days.value = await window.api.activity.listDays()
}

async function loadDay(date: string): Promise<void> {
  today.value = await window.api.activity.getDay(date)
}

// Silent reload of the viewed day, used by live updates (no spinner flicker).
async function reloadViewedDaySilently(): Promise<void> {
  if (!selectedDate.value) return
  try {
    await loadDay(selectedDate.value)
  } catch {
    // Ignore transient read errors during live updates.
  }
}

async function refresh(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    status.value = await window.api.activity.status()
    await loadDays()
    const date = selectedDate.value || status.value.date
    selectedDate.value = date
    await loadDay(date)
  } catch (error) {
    setError(error)
  } finally {
    loading.value = false
  }
}

async function viewDay(date: string): Promise<void> {
  if (!date) return
  loading.value = true
  errorMessage.value = ''
  try {
    selectedDate.value = date
    await loadDay(date)
  } catch (error) {
    setError(error)
  } finally {
    loading.value = false
  }
}

async function startTracking(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    status.value = await window.api.activity.start()
    selectedDate.value = status.value.date
    await loadDays()
    await loadDay(selectedDate.value)
  } catch (error) {
    setError(error)
  } finally {
    loading.value = false
  }
}

async function stopTracking(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    status.value = await window.api.activity.stop()
    await reloadViewedDaySilently()
  } catch (error) {
    setError(error)
  } finally {
    loading.value = false
  }
}

async function runBackfill(): Promise<void> {
  backfilling.value = true
  errorMessage.value = ''
  try {
    const result = await window.api.activity.backfill()
    backfillResult.value = result
    if (result.error) errorMessage.value = result.error
    await loadDays()
    await reloadViewedDaySilently()
  } catch (error) {
    setError(error)
  } finally {
    backfilling.value = false
  }
}

function openPermission(): void {
  void window.api.activity.openHistoryPermission()
}

function subscribe(): void {
  unsubscribeUpdate = window.api.activity.onUpdate((nextStatus) => {
    status.value = nextStatus
    if (nextStatus.running && selectedDate.value === nextStatus.date) {
      void reloadViewedDaySilently()
    }
  })
  unsubscribeEvent = window.api.activity.onEvent((event) => {
    liveEvents.value = [event, ...liveEvents.value].slice(0, 50)
  })
}

onMounted(() => {
  subscribe()
  void window.api.activity.backfillSupport().then((supported) => {
    backfillSupported.value = supported
  })
  void refresh()
})

onBeforeUnmount(() => {
  if (unsubscribeUpdate) unsubscribeUpdate()
  if (unsubscribeEvent) unsubscribeEvent()
})

// Today's live day may not have a saved file yet, so keep it selectable.
const dayOptions = computed(() => {
  const unique = new Set(days.value)
  if (status.value?.date) unique.add(status.value.date)
  return [...unique].sort((a, b) => b.localeCompare(a))
})

const selectedDayModel = computed({
  get: () => selectedDate.value,
  set: (value: string) => {
    void viewDay(value)
  },
})

const isLiveDay = computed(() => Boolean(status.value && selectedDate.value === status.value.date))
const isImportedDay = computed(() => today.value?.source === 'screen_time_import')

const appUsageRows = computed(() => today.value?.appUsage ?? [])
const sessionsRows = computed(() => today.value?.sessions ?? [])
const maxAppActiveMs = computed(() => Math.max(...appUsageRows.value.map((item) => item.activeMs), 0))

function eventKey(event: ActivityEvent): string {
  return [
    event.timestamp,
    event.type,
    event.source,
    event.app ?? '',
    event.appCategory ?? '',
    event.durationMinutes ?? '',
    JSON.stringify(event.meta ?? {}),
  ].join('|')
}

const eventRows = computed(() => {
  const rows: ActivityEvent[] = []
  const seen = new Set<string>()

  for (const event of [...liveEvents.value, ...(today.value?.events ?? [])]) {
    const key = eventKey(event)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(event)
    if (rows.length >= 50) break
  }

  return rows
})

function progressFor(activeMs: number): number {
  if (maxAppActiveMs.value <= 0) return 0
  return Math.round((activeMs / maxAppActiveMs.value) * 100)
}
</script>

<template>
  <main class="flex min-h-screen flex-col gap-6 p-6">
    <header class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight">Activity Tracker Test</h1>
        <p class="text-sm text-muted-foreground">Manual inspection page for live tracking data.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button :disabled="loading" @click="refresh">Refresh</Button>
        <Button :disabled="loading" variant="secondary" @click="startTracking">Start tracking</Button>
        <Button :disabled="loading" variant="outline" @click="stopTracking">Stop tracking</Button>

        <span class="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        <label class="text-sm text-muted-foreground" for="day-select">Day</label>
        <NativeSelect id="day-select" v-model="selectedDayModel" class="w-44">
          <option v-for="date in dayOptions" :key="date" :value="date">{{ date }}</option>
        </NativeSelect>
        <Badge v-if="isLiveDay" variant="success">Today</Badge>
        <Badge v-if="isImportedDay" variant="outline">Imported</Badge>
      </div>

      <div v-if="backfillSupported" class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <Button :disabled="backfilling" variant="secondary" @click="runBackfill">
            {{ backfilling ? 'Importing…' : 'Import from Screen Time' }}
          </Button>
          <Button v-if="backfillResult?.permissionRequired" variant="outline" @click="openPermission">
            Grant Full Disk Access
          </Button>
          <span class="text-xs text-muted-foreground">
            macOS only · imports historical per-app usage (needs Full Disk Access)
          </span>
        </div>
        <p v-if="backfillResult && !backfillResult.error" class="text-xs text-muted-foreground">
          Imported {{ backfillResult.importedDays.length }} day(s), skipped
          {{ backfillResult.skippedDays.length }} · {{ backfillResult.totalIntervals }} intervals
          <template v-if="backfillResult.rangeStart">
            · {{ backfillResult.rangeStart }} → {{ backfillResult.rangeEnd }}
          </template>
        </p>
      </div>

      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    </header>

    <section class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <Card class="gap-4 p-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-medium">Live status</h2>
          <Badge :variant="status?.running ? 'success' : 'secondary'">
            {{ status?.running ? 'running' : 'stopped' }}
          </Badge>
        </div>
        <dl class="grid gap-3 text-sm">
          <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">Provider</dt><dd>{{ status?.providerName ?? '—' }}</dd></div>
          <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">Idle state</dt><dd>{{ status?.idleState ?? '—' }}</dd></div>
          <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">Current app</dt><dd>{{ status?.currentApp ?? '—' }}</dd></div>
          <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">Current category</dt><dd>{{ status?.currentCategory ?? '—' }}</dd></div>
          <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">Current session</dt><dd>{{ formatDuration(status?.currentSessionMs) }}</dd></div>
          <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">Last sample</dt><dd>{{ formatDateTime(status?.lastSampleAt) }}</dd></div>
          <div class="flex items-center justify-between gap-3"><dt class="text-muted-foreground">Date</dt><dd>{{ status?.date ?? '—' }}</dd></div>
        </dl>
      </Card>

      <Card class="gap-4 p-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-medium">Day summary</h2>
          <span class="text-xs text-muted-foreground">{{ (today?.date ?? selectedDate) || '—' }}</span>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div><p class="text-sm text-muted-foreground">Active time</p><p class="text-lg font-medium">{{ formatDuration(today?.activeMs) }}</p></div>
          <div><p class="text-sm text-muted-foreground">Idle time</p><p class="text-lg font-medium">{{ formatDuration(today?.idleMs) }}</p></div>
          <div><p class="text-sm text-muted-foreground">Breaks</p><p class="text-lg font-medium">{{ formatNumber(today?.breakCount) }}</p></div>
          <div><p class="text-sm text-muted-foreground">Longest session</p><p class="text-lg font-medium">{{ formatDuration(today?.longestSessionMs) }}</p></div>
          <div><p class="text-sm text-muted-foreground">Context switches</p><p class="text-lg font-medium">{{ formatNumber(today?.contextSwitches) }}</p></div>
          <div><p class="text-sm text-muted-foreground">Late-night time</p><p class="text-lg font-medium">{{ formatDuration(today?.lateNightMs) }}</p></div>
        </div>
      </Card>

      <Card class="gap-4 p-5 xl:col-span-1">
        <h2 class="text-base font-medium">Raw JSON</h2>
        <div class="grid gap-3">
          <div>
            <p class="mb-2 text-sm text-muted-foreground">Status</p>
            <ScrollArea class="h-48 rounded-md border">
              <pre class="p-3 text-xs leading-5 whitespace-pre-wrap">{{ JSON.stringify(status, null, 2) }}</pre>
            </ScrollArea>
          </div>
          <div>
            <p class="mb-2 text-sm text-muted-foreground">Day</p>
            <ScrollArea class="h-48 rounded-md border">
              <pre class="p-3 text-xs leading-5 whitespace-pre-wrap">{{ JSON.stringify(today, null, 2) }}</pre>
            </ScrollArea>
          </div>
        </div>
      </Card>
    </section>

    <section class="grid gap-4">
      <Card class="gap-4 p-5">
        <h2 class="text-base font-medium">App usage</h2>
        <ScrollArea class="w-full rounded-md border">
          <div class="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Focuses</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="usage in appUsageRows" :key="`${usage.app}-${usage.firstSeen}`">
                  <TableCell>{{ usage.app }}</TableCell>
                  <TableCell>{{ usage.category }}</TableCell>
                  <TableCell>{{ formatDuration(usage.activeMs) }}</TableCell>
                  <TableCell>{{ usage.focusCount }}</TableCell>
                  <TableCell>{{ formatDateTime(usage.firstSeen) }}</TableCell>
                  <TableCell>{{ formatDateTime(usage.lastSeen) }}</TableCell>
                  <TableCell class="min-w-40">
                    <div class="flex items-center gap-3">
                      <Progress class="h-2 flex-1" :model-value="progressFor(usage.activeMs)" />
                      <span class="w-10 text-right text-xs text-muted-foreground">{{ progressFor(usage.activeMs) }}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </Card>

      <Card class="gap-4 p-5">
        <h2 class="text-base font-medium">Sessions</h2>
        <ScrollArea class="w-full rounded-md border">
          <div class="min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Switches</TableHead>
                  <TableHead>Top app</TableHead>
                  <TableHead>Top category</TableHead>
                  <TableHead>Late-night</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="session in sessionsRows" :key="session.id">
                  <TableCell>{{ formatDateTime(session.start) }}</TableCell>
                  <TableCell>{{ formatDateTime(session.end) }}</TableCell>
                  <TableCell>{{ formatDuration(session.activeMs) }}</TableCell>
                  <TableCell>{{ session.appSwitches }}</TableCell>
                  <TableCell>{{ session.topApp }}</TableCell>
                  <TableCell>{{ session.topCategory }}</TableCell>
                  <TableCell><Badge :variant="session.lateNight ? 'warning' : 'outline'">{{ session.lateNight ? 'yes' : 'no' }}</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </Card>

      <Card class="gap-4 p-5">
        <h2 class="text-base font-medium">Events</h2>
        <ScrollArea class="max-h-[28rem] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>App / category</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="event in eventRows" :key="eventKey(event)">
                <TableCell>{{ formatDateTime(event.timestamp) }}</TableCell>
                <TableCell>{{ event.type }}</TableCell>
                <TableCell>{{ [event.app, event.appCategory].filter(Boolean).join(' / ') || '—' }}</TableCell>
                <TableCell>{{ formatNumber(event.durationMinutes) }}</TableCell>
                <TableCell>
                  <pre class="text-xs whitespace-pre-wrap">{{ JSON.stringify(event.meta ?? {}, null, 2) }}</pre>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </section>
  </main>
</template>
