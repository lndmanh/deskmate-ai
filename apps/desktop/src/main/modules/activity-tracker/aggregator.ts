import { randomUUID } from 'crypto'
import { basename } from 'path'
import type {
  ActiveWindowSample,
  AppCategory,
  AppUsage,
  DailyUsage,
  IdleState,
  TrackerOptions,
  WorkEvent,
  WorkSession
} from './types'

/** Mutable per-application accumulator. */
interface AppState {
  app: string
  category: AppCategory
  activeMs: number
  focusCount: number
  firstSeen: number
  lastSeen: number
  bundleId?: string
  path?: string
}

/** Mutable accumulator for the currently open work session. */
interface SessionState {
  id: string
  start: number
  lastActiveAt: number
  activeMs: number
  appSwitches: number
  currentAppKey: string | null
  appMs: Map<string, number>
  catMs: Map<AppCategory, number>
  lateNight: boolean
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString()
}

function isoToMs(iso: string): number {
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : Date.now()
}

function appKey(sample: ActiveWindowSample): string {
  if (sample.bundleId && sample.bundleId.length > 0) {
    return sample.bundleId.toLowerCase()
  }
  if (sample.app.length > 0) {
    return sample.app.toLowerCase()
  }
  if (sample.path.length > 0) {
    return basename(sample.path).toLowerCase()
  }
  return 'unknown'
}

function addToMap<K>(map: Map<K, number>, key: K, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value)
}

function topKey<K>(map: Map<K, number>): K | null {
  let best: K | null = null
  let bestValue = -1
  for (const [key, value] of map) {
    if (value > bestValue) {
      best = key
      bestValue = value
    }
  }
  return best
}

/**
 * Accumulates one calendar day of desktop activity. The tracker drives it tick
 * by tick with either an active sample or an inactive (idle/locked) interval;
 * the aggregator derives sessions, breaks and per-app screen time, and emits
 * structured {@link WorkEvent}s for the event log.
 */
export class DailyAggregator {
  readonly date: string

  private readonly options: TrackerOptions
  private readonly apps = new Map<string, AppState>()
  private readonly sessions: WorkSession[] = []
  private readonly events: WorkEvent[] = []

  private activeMs = 0
  private idleMs = 0
  private breakCount = 0
  private longestSessionMs = 0
  private contextSwitches = 0
  private lateNightMs = 0

  private session: SessionState | null = null
  private inBreak = false

  constructor(date: string, options: TrackerOptions, existing?: DailyUsage | null) {
    this.date = date
    this.options = options
    if (existing && existing.date === date) {
      this.restore(existing)
    }
  }

  private restore(existing: DailyUsage): void {
    this.activeMs = existing.activeMs
    this.idleMs = existing.idleMs
    this.breakCount = existing.breakCount
    this.longestSessionMs = existing.longestSessionMs
    this.contextSwitches = existing.contextSwitches
    this.lateNightMs = existing.lateNightMs
    for (const usage of existing.appUsage) {
      this.apps.set(usage.app.toLowerCase(), {
        app: usage.app,
        category: usage.category,
        activeMs: usage.activeMs,
        focusCount: usage.focusCount,
        firstSeen: isoToMs(usage.firstSeen),
        lastSeen: isoToMs(usage.lastSeen),
        bundleId: usage.bundleId,
        path: usage.path
      })
    }
    this.sessions.push(...existing.sessions)
    this.events.push(...existing.events)
  }

  private isLateNight(at: number): boolean {
    const hour = new Date(at).getHours()
    const { lateNightStartHour, lateNightEndHour } = this.options
    if (lateNightStartHour <= lateNightEndHour) {
      return hour >= lateNightStartHour && hour < lateNightEndHour
    }
    // Wraps past midnight, e.g. 22:00 → 05:00.
    return hour >= lateNightStartHour || hour < lateNightEndHour
  }

  private displayName(key: string): string {
    return this.apps.get(key)?.app ?? key
  }

  private pushPersistable(event: WorkEvent): void {
    if (event.type !== 'work_session.continuous' && event.type !== 'activity.break') {
      return
    }
    this.events.push(event)
    const overflow = this.events.length - this.options.maxStoredEvents
    if (overflow > 0) {
      this.events.splice(0, overflow)
    }
  }

  private startSession(at: number): SessionState {
    const session: SessionState = {
      id: randomUUID(),
      start: at,
      lastActiveAt: at,
      activeMs: 0,
      appSwitches: 0,
      currentAppKey: null,
      appMs: new Map(),
      catMs: new Map(),
      lateNight: false
    }
    this.session = session
    return session
  }

  /** Attribute a focused interval to the given sample. */
  applyActive(
    sample: ActiveWindowSample,
    category: AppCategory,
    elapsedMs: number,
    at: number
  ): WorkEvent[] {
    const events: WorkEvent[] = []
    const ms = Math.max(0, elapsedMs)

    if (this.inBreak) {
      this.inBreak = false
      events.push({
        timestamp: msToIso(at),
        type: 'activity.idle.end',
        source: 'desktop_activity'
      })
    }

    const session = this.session ?? this.startSession(at)
    const key = appKey(sample)
    const isNewFocus = session.currentAppKey !== key

    if (session.currentAppKey !== null && isNewFocus) {
      session.appSwitches += 1
      this.contextSwitches += 1
      events.push({
        timestamp: msToIso(at),
        type: 'activity.app_switch',
        source: 'desktop_activity',
        app: sample.app,
        appCategory: category
      })
    }
    session.currentAppKey = key

    this.activeMs += ms
    session.activeMs += ms
    session.lastActiveAt = at
    addToMap(session.appMs, key, ms)
    addToMap(session.catMs, category, ms)

    if (this.isLateNight(at)) {
      this.lateNightMs += ms
      session.lateNight = true
    }

    const existing = this.apps.get(key)
    const app: AppState = existing ?? {
      app: sample.app,
      category,
      activeMs: 0,
      focusCount: 0,
      firstSeen: at,
      lastSeen: at
    }
    app.activeMs += ms
    app.lastSeen = at
    app.category = category
    if (isNewFocus) {
      app.focusCount += 1
    }
    if (sample.bundleId) {
      app.bundleId = sample.bundleId
    }
    if (sample.path) {
      app.path = sample.path
    }
    this.apps.set(key, app)

    return events
  }

  /** Account for an interval where the user was idle or the screen was locked. */
  applyInactive(
    elapsedMs: number,
    idleSeconds: number,
    at: number,
    idleState: IdleState
  ): WorkEvent[] {
    const events: WorkEvent[] = []
    this.idleMs += Math.max(0, elapsedMs)

    if (!this.session) {
      return events
    }

    const breakMs = this.options.breakThresholdSec * 1000
    const idleMs = idleSeconds * 1000
    const locked = idleState === 'locked'

    if (locked || idleMs >= breakMs) {
      const sessionEvent = this.closeOpenSession(at)
      if (sessionEvent) {
        events.push(sessionEvent)
      }
      this.breakCount += 1
      this.inBreak = true
      const breakEvent: WorkEvent = {
        timestamp: msToIso(at),
        type: 'activity.break',
        source: 'desktop_activity',
        meta: { reason: locked ? 'locked' : 'idle' }
      }
      this.pushPersistable(breakEvent)
      events.push(breakEvent)
    }

    return events
  }

  /** Finalize the open session (on break, flush or stop). Returns its event. */
  closeOpenSession(at: number): WorkEvent | null {
    const session = this.session
    this.session = null
    if (!session || session.activeMs <= 0) {
      return null
    }

    const end = Math.max(at, session.lastActiveAt)
    const topAppKey = topKey(session.appMs)
    const topCategory = topKey(session.catMs) ?? 'other'
    const topApp = topAppKey ? this.displayName(topAppKey) : 'Unknown'

    const workSession: WorkSession = {
      id: session.id,
      start: msToIso(session.start),
      end: msToIso(end),
      activeMs: session.activeMs,
      appSwitches: session.appSwitches,
      topApp,
      topCategory,
      lateNight: session.lateNight
    }
    this.sessions.push(workSession)
    this.longestSessionMs = Math.max(this.longestSessionMs, session.activeMs)

    const event: WorkEvent = {
      timestamp: workSession.end,
      type: 'work_session.continuous',
      source: 'desktop_activity',
      durationMinutes: Math.round(session.activeMs / 60000),
      appCategory: topCategory,
      app: topApp,
      meta: { appSwitches: session.appSwitches, lateNight: session.lateNight }
    }
    this.pushPersistable(event)
    return event
  }

  /** Focused milliseconds of the currently open session. */
  currentSessionMs(): number {
    return this.session?.activeMs ?? 0
  }

  hasOpenSession(): boolean {
    return this.session !== null
  }

  snapshot(): DailyUsage {
    const appUsage: AppUsage[] = [...this.apps.values()]
      .map((state) => ({
        app: state.app,
        category: state.category,
        activeMs: state.activeMs,
        focusCount: state.focusCount,
        firstSeen: msToIso(state.firstSeen),
        lastSeen: msToIso(state.lastSeen),
        bundleId: state.bundleId,
        path: state.path
      }))
      .sort((a, b) => b.activeMs - a.activeMs)

    return {
      date: this.date,
      updatedAt: new Date().toISOString(),
      source: 'desktop_activity',
      activeMs: this.activeMs,
      idleMs: this.idleMs,
      breakCount: this.breakCount,
      longestSessionMs: this.longestSessionMs,
      contextSwitches: this.contextSwitches,
      lateNightMs: this.lateNightMs,
      appUsage,
      sessions: [...this.sessions],
      events: [...this.events]
    }
  }
}
