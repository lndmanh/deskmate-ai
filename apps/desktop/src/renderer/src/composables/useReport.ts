import { ref } from 'vue'

import {
  createReportClient,
  type GenerateReportInput,
  type ReportResponse,
  type ReportScope
} from '@/services/report'

const DAY_MS = 86_400_000

type DailyUsage = Awaited<ReturnType<typeof window.api.activity.getToday>>

/**
 * Drives the Report screen: resolves the period window, gathers activity-tracker
 * data from the Electron main process (so the backend can include it alongside
 * mood + posture), and calls the `/report` endpoint.
 */
export function useReport() {
  const client = createReportClient()
  const report = ref<ReportResponse | null>(null)
  const loading = ref(false)
  const error = ref('')
  const scope = ref<ReportScope>('all')

  function periodWindow(currentScope: ReportScope, now: number): { fromMs: number; toMs: number } {
    if (currentScope === 'today') {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { fromMs: start.getTime(), toMs: now }
    }
    if (currentScope === '7d') {
      return { fromMs: now - 7 * DAY_MS, toMs: now }
    }
    return { fromMs: 0, toMs: now }
  }

  async function gatherActivity(currentScope: ReportScope): Promise<DailyUsage[]> {
    try {
      const activity = window.api.activity
      if (currentScope === 'today') {
        const today = await activity.getToday()
        return today ? [today] : []
      }

      const dates = await activity.listDays()
      const limit = currentScope === '7d' ? 7 : dates.length
      const loaded = await Promise.all(
        dates.slice(0, limit).map((date) => activity.getDay(date).catch(() => null))
      )
      const days = loaded.filter((day): day is DailyUsage => Boolean(day))

      // The live current day may not be persisted yet — fold it in if missing.
      const today = await activity.getToday().catch(() => null)
      if (today && !days.some((day) => day.date === today.date)) {
        days.unshift(today)
      }
      return days
    } catch {
      // No Electron bridge (e.g. browser preview) or tracker unavailable.
      return []
    }
  }

  async function generate(nextScope?: ReportScope): Promise<void> {
    if (nextScope) scope.value = nextScope
    const currentScope = scope.value

    loading.value = true
    error.value = ''
    try {
      const now = Date.now()
      const { fromMs, toMs } = periodWindow(currentScope, now)
      const activityDays = await gatherActivity(currentScope)
      const input: GenerateReportInput = {
        scope: currentScope,
        fromMs,
        toMs,
        referenceMs: now,
        activityDays
      }
      report.value = await client.generateReport(input)
    } catch (caught) {
      error.value =
        caught instanceof Error ? caught.message : 'Failed to generate the report.'
    } finally {
      loading.value = false
    }
  }

  return { report, loading, error, scope, generate }
}
