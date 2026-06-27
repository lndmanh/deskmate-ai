import { app, shell } from 'electron'
import { execFile } from 'child_process'
import { copyFile, unlink } from 'fs/promises'
import { join } from 'path'
import { DailyAggregator } from '../aggregator'
import { categorize } from '../categories'
import { saveDay, loadDay } from '../store'
import { endOfLocalDayMs, localDateKey } from '../time'
import {
  DEFAULT_TRACKER_OPTIONS,
  type ActiveWindowSample,
  type AppCategory,
  type BackfillResult,
  type DailyUsage,
  type TrackerOptions
} from '../types'

/**
 * macOS Screen Time backfill.
 *
 * macOS records per-app focus intervals in `knowledgeC.db` (the database behind
 * Screen Time). We read it — after the user grants Full Disk Access — and turn
 * the `/app/usage` stream into the same {@link DailyUsage} rollups the live
 * tracker produces, so historical days appear seamlessly alongside live data.
 *
 * Caveats (surfaced to the UI via {@link BackfillResult}):
 *   - Requires Full Disk Access (TCC); without it the read fails.
 *   - The schema is undocumented and varies across macOS versions.
 *   - Only a few weeks of detailed history are retained by the OS.
 *   - Idle time is unknown from this source, so it is reported as 0.
 */

/** Seconds between the Unix epoch (1970) and the Mac absolute-time epoch (2001). */
const MAC_EPOCH_OFFSET_SEC = 978307200
const EXEC_TIMEOUT_MS = 20000
const MAX_BUFFER = 32 * 1024 * 1024
const DEFAULT_MAX_DAYS = 30

interface RawInterval {
  bundle: string
  startMs: number
  endMs: number
}

interface DaySegment {
  bundle: string
  startMs: number
  endMs: number
}

interface ImportConfig {
  breakThresholdSec: number
  lateNightStartHour: number
  lateNightEndHour: number
  categoryOverrides: Record<string, AppCategory>
  maxStoredEvents: number
  maxDays: number
  overwrite: boolean
  skipDates: string[]
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: EXEC_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stdout)
      }
    )
  })
}

function errnoCode(error: unknown): string {
  if (error instanceof Error && 'code' in error) {
    const code = Reflect.get(error, 'code')
    return typeof code === 'string' ? code : ''
  }
  return ''
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await run('which', [command])
    return true
  } catch {
    return false
  }
}

function knowledgeDbPath(): string {
  return join(app.getPath('home'), 'Library', 'Application Support', 'Knowledge', 'knowledgeC.db')
}

/** Turn a bundle id into a readable app name, e.g. com.google.Chrome → Chrome. */
function bundleToName(bundle: string): string {
  const parts = bundle.split('.')
  const last = parts[parts.length - 1] || bundle
  return last.charAt(0).toUpperCase() + last.slice(1)
}

function bundleToSample(bundle: string): ActiveWindowSample {
  return {
    app: bundleToName(bundle),
    title: '',
    pid: 0,
    path: '',
    platform: 'macos',
    windowId: 0,
    bundleId: bundle
  }
}

const USAGE_QUERY =
  "SELECT ZVALUESTRING, ZSTARTDATE, ZENDDATE FROM ZOBJECT " +
  "WHERE ZSTREAMNAME = '/app/usage' AND ZVALUESTRING IS NOT NULL " +
  'AND ZENDDATE > ZSTARTDATE ORDER BY ZSTARTDATE'

function parseIntervals(stdout: string, cutoffMs: number): RawInterval[] {
  const intervals: RawInterval[] = []
  for (const line of stdout.split('\n')) {
    if (line.length === 0) {
      continue
    }
    const parts = line.split('\t')
    if (parts.length < 3) {
      continue
    }
    const bundle = parts[0]
    const start = Number.parseFloat(parts[1])
    const end = Number.parseFloat(parts[2])
    if (bundle.length === 0 || !Number.isFinite(start) || !Number.isFinite(end)) {
      continue
    }
    const startMs = (start + MAC_EPOCH_OFFSET_SEC) * 1000
    const endMs = (end + MAC_EPOCH_OFFSET_SEC) * 1000
    if (endMs <= startMs || endMs < cutoffMs) {
      continue
    }
    intervals.push({ bundle, startMs, endMs })
  }
  return intervals
}

/** Split an interval that crosses local midnight into per-day segments. */
function splitByDay(interval: RawInterval): DaySegment[] {
  const segments: DaySegment[] = []
  let cursor = interval.startMs
  while (cursor < interval.endMs) {
    const dayEnd = endOfLocalDayMs(cursor)
    const nextDayStart = dayEnd + 1
    const segmentEnd = Math.min(interval.endMs, nextDayStart)
    segments.push({ bundle: interval.bundle, startMs: cursor, endMs: segmentEnd })
    cursor = nextDayStart
  }
  return segments
}

function aggregatorOptions(config: ImportConfig): TrackerOptions {
  return {
    ...DEFAULT_TRACKER_OPTIONS,
    breakThresholdSec: config.breakThresholdSec,
    lateNightStartHour: config.lateNightStartHour,
    lateNightEndHour: config.lateNightEndHour,
    categoryOverrides: config.categoryOverrides,
    maxStoredEvents: config.maxStoredEvents
  }
}

/** Build a DailyUsage for one day from its sorted segments. */
function buildDay(date: string, segments: DaySegment[], config: ImportConfig): DailyUsage {
  const options = aggregatorOptions(config)
  const aggregator = new DailyAggregator(date, options)
  const breakMs = config.breakThresholdSec * 1000

  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs)
  let lastEnd: number | null = null
  for (const segment of sorted) {
    if (lastEnd !== null) {
      const gap = segment.startMs - lastEnd
      if (gap > 0) {
        // Close the session when the gap is a real break. We pass 0 elapsed so
        // idle time isn't fabricated (Screen Time doesn't report idle).
        const state = gap >= breakMs ? 'idle' : 'active'
        aggregator.applyInactive(0, gap / 1000, segment.startMs, state)
      }
    }
    const sample = bundleToSample(segment.bundle)
    const category = categorize(sample, config.categoryOverrides)
    aggregator.applyActive(sample, category, segment.endMs - segment.startMs, segment.endMs)
    lastEnd = segment.endMs
  }
  aggregator.closeOpenSession(lastEnd ?? Date.now())

  const usage = aggregator.snapshot()
  usage.source = 'screen_time_import'
  usage.events = usage.events.map((event) => ({ ...event, source: 'screen_time_import' }))
  return usage
}

function failure(
  supported: boolean,
  permissionRequired: boolean,
  error: string | null
): BackfillResult {
  return {
    supported,
    permissionRequired,
    importedDays: [],
    skippedDays: [],
    totalIntervals: 0,
    rangeStart: null,
    rangeEnd: null,
    source: 'screen_time',
    error
  }
}

export function isScreenTimeBackfillSupported(): boolean {
  return process.platform === 'darwin'
}

export async function openScreenTimePermission(): Promise<void> {
  if (process.platform !== 'darwin') {
    return
  }
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
  )
}

export async function importMacScreenTime(
  partial: Partial<ImportConfig> = {}
): Promise<BackfillResult> {
  if (process.platform !== 'darwin') {
    return failure(false, false, 'Screen Time backfill is only available on macOS.')
  }

  const config: ImportConfig = {
    breakThresholdSec: partial.breakThresholdSec ?? DEFAULT_TRACKER_OPTIONS.breakThresholdSec,
    lateNightStartHour: partial.lateNightStartHour ?? DEFAULT_TRACKER_OPTIONS.lateNightStartHour,
    lateNightEndHour: partial.lateNightEndHour ?? DEFAULT_TRACKER_OPTIONS.lateNightEndHour,
    categoryOverrides: partial.categoryOverrides ?? {},
    maxStoredEvents: partial.maxStoredEvents ?? DEFAULT_TRACKER_OPTIONS.maxStoredEvents,
    maxDays: partial.maxDays ?? DEFAULT_MAX_DAYS,
    overwrite: partial.overwrite ?? false,
    skipDates: partial.skipDates ?? []
  }

  if (!(await commandExists('sqlite3'))) {
    return failure(true, false, 'The sqlite3 command was not found on this system.')
  }

  const source = knowledgeDbPath()
  const tempBase = join(app.getPath('temp'), `deskmate-knowledgeC-${process.pid}-${Date.now()}.db`)
  const tempFiles = [tempBase, `${tempBase}-wal`, `${tempBase}-shm`]

  // Copy the DB (and its WAL/SHM sidecars when present) so we read a stable
  // snapshot without locking the live database.
  try {
    await copyFile(source, tempBase)
  } catch (error) {
    const code = errnoCode(error)
    if (code === 'ENOENT') {
      return failure(true, false, 'No Screen Time database found (knowledgeC.db is missing).')
    }
    if (code === 'EPERM' || code === 'EACCES') {
      return failure(true, true, 'Full Disk Access is required to read Screen Time data.')
    }
    return failure(true, false, `Could not read Screen Time data: ${code || 'unknown error'}.`)
  }
  await copyFile(`${source}-wal`, `${tempBase}-wal`).catch(() => undefined)
  await copyFile(`${source}-shm`, `${tempBase}-shm`).catch(() => undefined)

  try {
    const stdout = await run('sqlite3', ['-readonly', '-separator', '\t', tempBase, USAGE_QUERY])
    const cutoffMs = Date.now() - config.maxDays * 24 * 60 * 60 * 1000
    const intervals = parseIntervals(stdout, cutoffMs)

    const byDay = new Map<string, DaySegment[]>()
    for (const interval of intervals) {
      for (const segment of splitByDay(interval)) {
        const bucket = byDay.get(localDateKey(segment.startMs))
        if (bucket) {
          bucket.push(segment)
        } else {
          byDay.set(localDateKey(segment.startMs), [segment])
        }
      }
    }

    const allDays = [...byDay.keys()].sort()
    const importedDays: string[] = []
    const skippedDays: string[] = []

    for (const date of allDays) {
      if (config.skipDates.includes(date)) {
        skippedDays.push(date)
        continue
      }
      if (!config.overwrite && (await loadDay(date)) !== null) {
        skippedDays.push(date)
        continue
      }
      const segments = byDay.get(date) ?? []
      await saveDay(buildDay(date, segments, config))
      importedDays.push(date)
    }

    return {
      supported: true,
      permissionRequired: false,
      importedDays,
      skippedDays,
      totalIntervals: intervals.length,
      rangeStart: allDays[0] ?? null,
      rangeEnd: allDays[allDays.length - 1] ?? null,
      source: 'screen_time',
      error: null
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return failure(true, false, `Failed to query Screen Time data: ${message}.`)
  } finally {
    await Promise.all(tempFiles.map((file) => unlink(file).catch(() => undefined)))
  }
}
