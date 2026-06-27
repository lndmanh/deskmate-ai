// Derived insights over the activity-tracker's daily rollups.
//
// The activity data types are owned by the main-process tracker module. Rather
// than import main-process code into the renderer bundle, we derive the shapes
// from the `window.api.activity` bridge (the same pattern ActivityTestView uses).

export type DailyUsage = Awaited<ReturnType<typeof window.api.activity.getToday>>
export type TrackerStatus = Awaited<ReturnType<typeof window.api.activity.status>>
export type AppUsage = DailyUsage['appUsage'][number]
export type WorkSession = DailyUsage['sessions'][number]
export type AppCategory = AppUsage['category']

/** One point in the multi-day trend (active + late-night time per calendar day). */
export interface TrendPoint {
  date: string
  activeMs: number
  lateNightMs: number
}

export interface CategoryMeta {
  label: string
  color: string
}

// A vivid, well-separated palette so categories stay distinguishable in both
// light and dark themes. Hex values render reliably on the ECharts canvas.
export const CATEGORY_META: Record<string, CategoryMeta> = {
  coding: { label: 'Coding', color: '#6366f1' },
  meeting: { label: 'Meetings', color: '#ec4899' },
  communication: { label: 'Communication', color: '#f59e0b' },
  writing: { label: 'Writing', color: '#14b8a6' },
  design: { label: 'Design', color: '#a855f7' },
  browsing: { label: 'Browsing', color: '#3b82f6' },
  support: { label: 'Support', color: '#ef4444' },
  media: { label: 'Media', color: '#fb7185' },
  productivity: { label: 'Productivity', color: '#22c55e' },
  system: { label: 'System', color: '#64748b' },
  other: { label: 'Other', color: '#94a3b8' }
}

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] ?? { label: titleCase(category || 'Other'), color: '#94a3b8' }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Compact duration, e.g. "3h 12m", "12m", "0m". Seconds are intentionally dropped. */
export function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return '0m'
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

/** Minutes → compact duration (chart values are stored in minutes). */
export function formatMinutes(minutes?: number | null): string {
  return formatDuration((minutes ?? 0) * 60000)
}

/** Hour-of-day label, e.g. 0 → "12 AM", 13 → "1 PM". */
export function formatClockHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24
  const period = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display} ${period}`
}

/** "2026-06-27" → "Jun 27". */
export function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------------

export interface CategorySlice {
  category: string
  label: string
  color: string
  activeMs: number
  pct: number
}

/** Per-category active time for a day, sorted by time descending. */
export function categoryBreakdown(day?: DailyUsage | null): CategorySlice[] {
  const totals = new Map<string, number>()
  for (const app of day?.appUsage ?? []) {
    totals.set(app.category, (totals.get(app.category) ?? 0) + app.activeMs)
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0) || 1
  return [...totals.entries()]
    .map(([category, activeMs]) => {
      const meta = categoryMeta(category)
      return { category, label: meta.label, color: meta.color, activeMs, pct: (activeMs / total) * 100 }
    })
    .sort((a, b) => b.activeMs - a.activeMs)
}

export interface AppSlice {
  app: string
  category: string
  color: string
  activeMs: number
  focusCount: number
}

/** Top N apps by active time. */
export function topApps(day?: DailyUsage | null, limit = 8): AppSlice[] {
  return [...(day?.appUsage ?? [])]
    .sort((a, b) => b.activeMs - a.activeMs)
    .slice(0, limit)
    .map((app) => ({
      app: app.app,
      category: app.category,
      color: categoryMeta(app.category).color,
      activeMs: app.activeMs,
      focusCount: app.focusCount
    }))
}

/**
 * Active minutes per hour-of-day (24 buckets). Each work session's focused time
 * is distributed across the clock hours it spans, weighted by how much of the
 * session's wall-clock duration falls in each hour.
 */
export function hourlyActiveMinutes(day?: DailyUsage | null): number[] {
  const buckets = new Array<number>(24).fill(0)
  for (const session of day?.sessions ?? []) {
    const start = new Date(session.start).getTime()
    const end = new Date(session.end).getTime()
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue
    const wall = end - start
    const active = session.activeMs ?? 0
    let cursor = start
    while (cursor < end) {
      const at = new Date(cursor)
      const hour = at.getHours()
      const nextHour = new Date(at)
      nextHour.setMinutes(60, 0, 0)
      const sliceEnd = Math.min(nextHour.getTime(), end)
      const overlap = sliceEnd - cursor
      buckets[hour] += (active * (overlap / wall)) / 60000
      cursor = sliceEnd
    }
  }
  return buckets.map((value) => Math.round(value))
}

export interface DaySummary {
  date: string
  activeMs: number
  idleMs: number
  breakCount: number
  longestSessionMs: number
  contextSwitches: number
  lateNightMs: number
  sessionCount: number
  focusRatio: number
  topCategory?: CategorySlice
  topApp?: AppSlice
}

export function summarize(day?: DailyUsage | null): DaySummary {
  const categories = categoryBreakdown(day)
  const apps = topApps(day, 1)
  const activeMs = day?.activeMs ?? 0
  const idleMs = day?.idleMs ?? 0
  const denominator = activeMs + idleMs
  return {
    date: day?.date ?? '',
    activeMs,
    idleMs,
    breakCount: day?.breakCount ?? 0,
    longestSessionMs: day?.longestSessionMs ?? 0,
    contextSwitches: day?.contextSwitches ?? 0,
    lateNightMs: day?.lateNightMs ?? 0,
    sessionCount: day?.sessions?.length ?? 0,
    focusRatio: denominator > 0 ? activeMs / denominator : 0,
    topCategory: categories[0],
    topApp: apps[0]
  }
}

export function hasActivity(day?: DailyUsage | null): boolean {
  return Boolean(day && (day.activeMs > 0 || (day.appUsage?.length ?? 0) > 0))
}

// ---------------------------------------------------------------------------
// Summary generation (LLM prompt + on-device fallback)
// ---------------------------------------------------------------------------

function trendDelta(day: DailyUsage, trend?: TrendPoint[]): number | null {
  if (!trend || trend.length < 2) return null
  const prior = trend.filter((point) => point.date !== day.date)
  if (prior.length === 0) return null
  const average = prior.reduce((sum, point) => sum + point.activeMs, 0) / prior.length
  if (average <= 0) return null
  return ((day.activeMs - average) / average) * 100
}

/** Build the system + user prompt that asks an LLM for a short activity summary. */
export function buildSummaryPrompt(
  day: DailyUsage,
  trend?: TrendPoint[]
): { system: string; prompt: string } {
  const stats = summarize(day)
  const categories = categoryBreakdown(day)
    .slice(0, 5)
    .map((slice) => `${slice.label}: ${formatDuration(slice.activeMs)} (${Math.round(slice.pct)}%)`)
  const apps = topApps(day, 5).map((app) => `${app.app}: ${formatDuration(app.activeMs)}`)
  const delta = trendDelta(day, trend)

  const payload = {
    date: day.date,
    focusedTime: formatDuration(stats.activeMs),
    idleTime: formatDuration(stats.idleMs),
    focusRatioPercent: Math.round(stats.focusRatio * 100),
    workSessions: stats.sessionCount,
    longestSession: formatDuration(stats.longestSessionMs),
    breaks: stats.breakCount,
    contextSwitches: stats.contextSwitches,
    lateNightTime: formatDuration(stats.lateNightMs),
    vsRecentAverage: delta === null ? 'n/a' : `${delta >= 0 ? '+' : ''}${Math.round(delta)}%`,
    topCategories: categories,
    topApps: apps
  }

  const system =
    'You are DeskMate, a warm, supportive work-wellness companion. Given a summary of ' +
    "a person's computer activity for one day, write a brief, encouraging recap in 3-4 " +
    'sentences. Reference concrete numbers from the data, comment on focus and work-life ' +
    'balance, and finish with ONE gentle, actionable suggestion (e.g. about breaks, ' +
    'context-switching, or late-night work). Keep a friendly, human tone. Do not use ' +
    'markdown, headings, bullet points, or emojis. Avoid medical claims.'

  const prompt =
    'Here is the activity data as JSON. Write the recap:\n\n' + JSON.stringify(payload, null, 2)

  return { system, prompt }
}

/**
 * Deterministic, data-specific summary generated entirely on-device. Used when
 * no LLM API key is configured, or when the LLM request fails.
 */
export function buildLocalSummary(day?: DailyUsage | null, trend?: TrendPoint[]): string {
  if (!day || !hasActivity(day)) {
    return 'No focused activity has been tracked for this day yet. Start tracking and DeskMate will surface how your time is spent, when you focus best, and where your day gets fragmented.'
  }

  const stats = summarize(day)
  const sentences: string[] = []

  const sessionText =
    stats.sessionCount > 0
      ? ` across ${stats.sessionCount} work session${stats.sessionCount === 1 ? '' : 's'}`
      : ''
  const leadCategory = stats.topCategory
    ? `, led by ${stats.topCategory.label.toLowerCase()} at ${Math.round(stats.topCategory.pct)}%`
    : ''
  sentences.push(`You logged ${formatDuration(stats.activeMs)} of focused time${sessionText}${leadCategory}.`)

  const longest = stats.longestSessionMs > 0 ? `your longest stretch ran ${formatDuration(stats.longestSessionMs)}, and ` : ''
  sentences.push(
    `That kept you about ${Math.round(stats.focusRatio * 100)}% focused while active — ${longest}you changed apps ${stats.contextSwitches} time${stats.contextSwitches === 1 ? '' : 's'}.`
  )

  const delta = trendDelta(day, trend)
  if (delta !== null && Math.abs(delta) >= 8) {
    sentences.push(
      `That's ${Math.abs(Math.round(delta))}% ${delta >= 0 ? 'more' : 'less'} focused time than your recent average.`
    )
  }

  // One gentle, condition-based suggestion.
  if (stats.lateNightMs >= 20 * 60000) {
    sentences.push(
      `You spent ${formatDuration(stats.lateNightMs)} working late at night — try to wind down a little earlier to protect tomorrow's energy.`
    )
  } else if (stats.contextSwitches >= 60) {
    sentences.push(
      'Your attention bounced between apps a lot today; batching similar tasks could help you find deeper focus.'
    )
  } else if (stats.breakCount === 0 && stats.activeMs >= 90 * 60000) {
    sentences.push('You powered through with no real breaks — a short pause now and then will keep you sharp.')
  } else {
    sentences.push('Nice balance today — keep protecting the blocks where you focus best.')
  }

  return sentences.join(' ')
}
