/**
 * Shared domain types for the Desktop Activity tracker.
 *
 * This module is the "desktop activity" data connector that feeds the
 * Work Rhythm Module (README §9 Module 1, §17). It turns a stream of
 * active-window samples into derived signals: per-app screen time,
 * continuous work sessions, breaks, context switching and late-night work.
 *
 * Privacy: by default we only keep derived signals (app name + category +
 * durations). Window titles and browser URLs are opt-in.
 */

export type AppCategory =
  | 'coding'
  | 'meeting'
  | 'communication'
  | 'writing'
  | 'design'
  | 'browsing'
  | 'support'
  | 'media'
  | 'productivity'
  | 'system'
  | 'other'

export type IdleState = 'active' | 'idle' | 'locked' | 'unknown'

export type ActivitySource = 'desktop_activity' | 'screen_time_import'

/** A single point-in-time reading of the foreground window. */
export interface ActiveWindowSample {
  /** Display name of the owning application, e.g. "Visual Studio Code". */
  app: string
  /** Window title (empty unless titles are captured). */
  title: string
  /** Owner process id. */
  pid: number
  /** Absolute path to the owner executable / bundle. */
  path: string
  /** OS family the sample came from. */
  platform: 'macos' | 'windows' | 'linux' | 'unknown'
  /** Native window identifier (handle on Windows). */
  windowId: number
  /** Bundle identifier (macOS only). */
  bundleId?: string
  /** Active browser tab URL (macOS only, opt-in). */
  url?: string
}

/** Per-application rollup for a single day. */
export interface AppUsage {
  app: string
  category: AppCategory
  /** Total focused time in milliseconds. */
  activeMs: number
  /** Number of times this app gained focus. */
  focusCount: number
  firstSeen: string
  lastSeen: string
  bundleId?: string
  path?: string
}

/** A continuous block of work, bounded by breaks (long idle / lock). */
export interface WorkSession {
  id: string
  start: string
  end: string
  /** Focused time within the session (excludes short idle gaps). */
  activeMs: number
  /** Number of app switches inside the session. */
  appSwitches: number
  topApp: string
  topCategory: AppCategory
  /** True when the session overlaps the late-night window. */
  lateNight: boolean
}

export type WorkEventType =
  | 'work_session.continuous'
  | 'activity.break'
  | 'activity.idle.start'
  | 'activity.idle.end'
  | 'activity.app_switch'

/** A structured event for the event log / AI reasoning layer (README §18.3). */
export interface WorkEvent {
  timestamp: string
  type: WorkEventType
  source: ActivitySource
  durationMinutes?: number
  appCategory?: AppCategory
  app?: string
  meta?: Record<string, number | string | boolean>
}

/** Everything tracked for one calendar day. */
export interface DailyUsage {
  /** Local calendar day, formatted YYYY-MM-DD. */
  date: string
  updatedAt: string
  source: ActivitySource
  /** Total focused time across all apps. */
  activeMs: number
  /** Total idle time while the app was tracking. */
  idleMs: number
  breakCount: number
  /** Longest continuous work session (focused ms). */
  longestSessionMs: number
  /** Total app switches across the day. */
  contextSwitches: number
  /** Focused time inside the late-night window. */
  lateNightMs: number
  appUsage: AppUsage[]
  sessions: WorkSession[]
  events: WorkEvent[]
}

/** Live status of the tracker, suitable for the renderer. */
export interface TrackerStatus {
  running: boolean
  /** Name of the active detection provider, or null when none resolved. */
  providerName: string | null
  idleState: IdleState
  currentApp: string | null
  currentCategory: AppCategory | null
  /** Focused ms of the currently open work session. */
  currentSessionMs: number
  lastSampleAt: string | null
  date: string
}

export interface TrackerOptions {
  /** How often the foreground window is sampled. */
  pollIntervalMs: number
  /** Idle seconds after which the user is considered away. */
  idleThresholdSec: number
  /** Idle seconds that end the current work session (a real break). */
  breakThresholdSec: number
  /** Capture window titles (needs macOS screen-recording permission). */
  captureTitles: boolean
  /** Capture browser URLs (needs macOS accessibility permission). */
  captureUrls: boolean
  /** Hour [0-23] when the late-night window starts. */
  lateNightStartHour: number
  /** Hour [0-23] when the late-night window ends (next morning). */
  lateNightEndHour: number
  /** Persist daily rollups to userData. */
  persist: boolean
  /** Override the category for specific apps (lowercased app name → category). */
  categoryOverrides: Record<string, AppCategory>
  /** Cap on persisted events per day. */
  maxStoredEvents: number
}

export interface BackfillOptions {
  /** How many days back to import (default 30). */
  maxDays?: number
  /** Overwrite days that already have stored data (default false). */
  overwrite?: boolean
  /** Dates (YYYY-MM-DD) to never touch — e.g. the live current day. */
  skipDates?: string[]
}

export interface BackfillResult {
  /** True when the platform offers a historical source (macOS only). */
  supported: boolean
  /** True when the OS needs a permission grant (macOS Full Disk Access). */
  permissionRequired: boolean
  /** Days written by this run. */
  importedDays: string[]
  /** Days skipped because they already existed or were excluded. */
  skippedDays: string[]
  /** Total raw usage intervals read from the source. */
  totalIntervals: number
  /** Earliest / latest day seen in the source, or null when none. */
  rangeStart: string | null
  rangeEnd: string | null
  /** Identifier of the data source used. */
  source: 'screen_time'
  /** Human-readable error, or null on success. */
  error: string | null
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
  pollIntervalMs: 4000,
  idleThresholdSec: 60,
  breakThresholdSec: 300,
  captureTitles: false,
  captureUrls: false,
  lateNightStartHour: 22,
  lateNightEndHour: 5,
  persist: true,
  categoryOverrides: {},
  maxStoredEvents: 500
}
