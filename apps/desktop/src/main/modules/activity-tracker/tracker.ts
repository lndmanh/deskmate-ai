import { powerMonitor } from 'electron'
import { DailyAggregator } from './aggregator'
import { categorize } from './categories'
import { getIdleSeconds, getIdleState } from './idle'
import { createCompositeProvider } from './providers'
import type { ProviderQueryOptions, ResolvedProvider } from './providers'
import { listDays, loadDay, saveDay } from './store'
import { localDateKey } from './time'
import {
  importMacScreenTime,
  isScreenTimeBackfillSupported,
  openScreenTimePermission
} from './history/macScreenTime'
import {
  DEFAULT_TRACKER_OPTIONS,
  type ActiveWindowSample,
  type AppCategory,
  type BackfillOptions,
  type BackfillResult,
  type DailyUsage,
  type IdleState,
  type TrackerOptions,
  type TrackerStatus,
  type WorkEvent
} from './types'

/** How often, at most, the current day is written to disk while running. */
const PERSIST_INTERVAL_MS = 15000

type Handler<T> = (payload: T) => void

/** Minimal typed listener registry (avoids Node EventEmitter's loose typing). */
class Emitter<T> {
  private readonly handlers = new Set<Handler<T>>()

  on(handler: Handler<T>): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  emit(payload: T): void {
    for (const handler of this.handlers) {
      handler(payload)
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

export interface ActivityTracker {
  start(): Promise<TrackerStatus>
  stop(): Promise<TrackerStatus>
  getStatus(): TrackerStatus
  getToday(): DailyUsage
  getDay(date: string): Promise<DailyUsage | null>
  listDays(): Promise<string[]>
  /** Import historical days from macOS Screen Time (no-op off macOS). */
  backfill(options?: BackfillOptions): Promise<BackfillResult>
  /** Whether historical backfill is available on this platform. */
  isBackfillSupported(): boolean
  /** Open the OS permission pane required for backfill (macOS Full Disk Access). */
  openHistoryPermission(): Promise<void>
  onUpdate(handler: Handler<TrackerStatus>): () => void
  onEvent(handler: Handler<WorkEvent>): () => void
  flush(): Promise<void>
  dispose(): Promise<void>
}

class ActivityTrackerImpl implements ActivityTracker {
  private readonly options: TrackerOptions
  private readonly queryOptions: ProviderQueryOptions
  private readonly provider: ResolvedProvider = createCompositeProvider()
  private readonly updateEmitter = new Emitter<TrackerStatus>()
  private readonly eventEmitter = new Emitter<WorkEvent>()

  private aggregator: DailyAggregator
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private lastTick = Date.now()
  private lastPersistAt = 0
  private dirty = false

  private lastSample: ActiveWindowSample | null = null
  private lastCategory: AppCategory | null = null
  private lastSampleAt: number | null = null
  private idleState: IdleState = 'unknown'

  private readonly handleAway = (): void => {
    const now = Date.now()
    const events = this.aggregator.applyInactive(
      0,
      this.options.breakThresholdSec + 1,
      now,
      'locked'
    )
    for (const event of events) {
      this.eventEmitter.emit(event)
    }
    this.idleState = 'locked'
    this.dirty = true
    void this.persist(true)
  }

  private readonly handleResume = (): void => {
    // Don't attribute the suspended interval to the previously focused app.
    this.lastTick = Date.now()
  }

  constructor(options?: Partial<TrackerOptions>) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options }
    this.queryOptions = {
      captureTitles: this.options.captureTitles,
      captureUrls: this.options.captureUrls
    }
    this.aggregator = new DailyAggregator(localDateKey(Date.now()), this.options)
  }

  async start(): Promise<TrackerStatus> {
    if (this.running) {
      return this.getStatus()
    }

    const today = localDateKey(Date.now())
    const existing = await loadDay(today)
    this.aggregator = new DailyAggregator(today, this.options, existing)

    // Resolve which provider we'll use so status reflects it immediately.
    await this.provider.isAvailable()

    this.running = true
    this.lastTick = Date.now()
    this.lastPersistAt = Date.now()
    this.addPowerListeners()
    this.scheduleNext(0)

    return this.getStatus()
  }

  async stop(): Promise<TrackerStatus> {
    if (!this.running) {
      return this.getStatus()
    }
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.removePowerListeners()
    this.aggregator.closeOpenSession(Date.now())
    await this.persist(true)

    const status = this.getStatus()
    this.updateEmitter.emit(status)
    return status
  }

  getStatus(): TrackerStatus {
    return {
      running: this.running,
      providerName: this.provider.activeName(),
      idleState: this.idleState,
      currentApp: this.lastSample?.app ?? null,
      currentCategory: this.lastCategory,
      currentSessionMs: this.aggregator.currentSessionMs(),
      lastSampleAt: this.lastSampleAt ? new Date(this.lastSampleAt).toISOString() : null,
      date: this.aggregator.date
    }
  }

  getToday(): DailyUsage {
    return this.aggregator.snapshot()
  }

  async getDay(date: string): Promise<DailyUsage | null> {
    if (date === this.aggregator.date) {
      return this.aggregator.snapshot()
    }
    return loadDay(date)
  }

  listDays(): Promise<string[]> {
    return listDays()
  }

  isBackfillSupported(): boolean {
    return isScreenTimeBackfillSupported()
  }

  openHistoryPermission(): Promise<void> {
    return openScreenTimePermission()
  }

  backfill(options?: BackfillOptions): Promise<BackfillResult> {
    return importMacScreenTime({
      breakThresholdSec: this.options.breakThresholdSec,
      lateNightStartHour: this.options.lateNightStartHour,
      lateNightEndHour: this.options.lateNightEndHour,
      categoryOverrides: this.options.categoryOverrides,
      maxStoredEvents: this.options.maxStoredEvents,
      // Never overwrite the live current day.
      skipDates: [this.aggregator.date],
      ...options
    })
  }

  onUpdate(handler: Handler<TrackerStatus>): () => void {
    return this.updateEmitter.on(handler)
  }

  onEvent(handler: Handler<WorkEvent>): () => void {
    return this.eventEmitter.on(handler)
  }

  flush(): Promise<void> {
    return this.persist(true)
  }

  async dispose(): Promise<void> {
    await this.stop()
    this.updateEmitter.clear()
    this.eventEmitter.clear()
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => {
      void this.tick()
    }, delayMs)
  }

  private async tick(): Promise<void> {
    if (!this.running) {
      return
    }

    const now = Date.now()
    const elapsed = now - this.lastTick
    this.lastTick = now

    const today = localDateKey(now)
    if (today !== this.aggregator.date) {
      await this.rollover(today)
    }

    // Cap the attributed interval so a missed tick (sleep, stall) can't dump a
    // huge block of time onto one app.
    const capped = Math.min(Math.max(elapsed, 0), this.options.pollIntervalMs * 3)
    const idleSeconds = getIdleSeconds()
    const idleState = getIdleState(this.options.idleThresholdSec)
    this.idleState = idleState

    let events: WorkEvent[] = []
    if (idleState === 'active') {
      const sample = await this.safeSample()
      if (sample) {
        const category = categorize(sample, this.options.categoryOverrides)
        this.lastSample = sample
        this.lastCategory = category
        this.lastSampleAt = now
        events = this.aggregator.applyActive(sample, category, capped, now)
      } else {
        // Input is recent but we can't identify the window: treat as idle so we
        // never attribute time to the wrong app.
        events = this.aggregator.applyInactive(capped, idleSeconds, now, 'unknown')
      }
    } else {
      events = this.aggregator.applyInactive(capped, idleSeconds, now, idleState)
    }

    this.dirty = true
    for (const event of events) {
      this.eventEmitter.emit(event)
    }

    if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      await this.persist(false)
    }

    this.updateEmitter.emit(this.getStatus())

    if (this.running) {
      this.scheduleNext(this.options.pollIntervalMs)
    }
  }

  private async safeSample(): Promise<ActiveWindowSample | null> {
    try {
      return await this.provider.getActiveWindow(this.queryOptions)
    } catch {
      return null
    }
  }

  private async rollover(newDate: string): Promise<void> {
    this.aggregator.closeOpenSession(Date.now())
    await this.persist(true)
    const existing = await loadDay(newDate)
    this.aggregator = new DailyAggregator(newDate, this.options, existing)
    this.lastSample = null
    this.lastCategory = null
  }

  private async persist(force: boolean): Promise<void> {
    if (!this.options.persist) {
      return
    }
    if (!force && !this.dirty) {
      return
    }
    this.lastPersistAt = Date.now()
    this.dirty = false
    try {
      await saveDay(this.aggregator.snapshot())
    } catch {
      // Best effort: keep the data and retry on the next interval.
      this.dirty = true
    }
  }

  private addPowerListeners(): void {
    powerMonitor.on('suspend', this.handleAway)
    powerMonitor.on('lock-screen', this.handleAway)
    powerMonitor.on('resume', this.handleResume)
    powerMonitor.on('unlock-screen', this.handleResume)
  }

  private removePowerListeners(): void {
    powerMonitor.removeListener('suspend', this.handleAway)
    powerMonitor.removeListener('lock-screen', this.handleAway)
    powerMonitor.removeListener('resume', this.handleResume)
    powerMonitor.removeListener('unlock-screen', this.handleResume)
  }
}

export function createActivityTracker(options?: Partial<TrackerOptions>): ActivityTracker {
  return new ActivityTrackerImpl(options)
}
