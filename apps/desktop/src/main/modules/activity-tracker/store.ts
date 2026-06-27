import { app } from 'electron'
import { mkdir, readdir, readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'
import type { DailyUsage } from './types'

/**
 * Local-first JSON persistence for daily activity rollups, one file per day
 * under `userData/activity/`. Writes are atomic (temp file + rename) so a crash
 * mid-write can't corrupt a day's data.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function activityDir(): string {
  return join(app.getPath('userData'), 'activity')
}

function dayFile(date: string): string {
  return join(activityDir(), `${date}.json`)
}

function isDailyUsage(value: unknown): value is DailyUsage {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record: Record<string, unknown> = { ...value }
  return (
    typeof record.date === 'string' &&
    typeof record.activeMs === 'number' &&
    typeof record.idleMs === 'number' &&
    Array.isArray(record.appUsage) &&
    Array.isArray(record.sessions) &&
    Array.isArray(record.events)
  )
}

/** Read a single day's rollup, or null when missing / unreadable / invalid. */
export async function loadDay(date: string): Promise<DailyUsage | null> {
  try {
    const raw = await readFile(dayFile(date), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return isDailyUsage(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Persist a day's rollup atomically. */
export async function saveDay(usage: DailyUsage): Promise<void> {
  await mkdir(activityDir(), { recursive: true })
  const target = dayFile(usage.date)
  const temp = `${target}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(usage, null, 2), 'utf8')
  await rename(temp, target)
}

/** List the dates (YYYY-MM-DD) that have stored rollups, newest first. */
export async function listDays(): Promise<string[]> {
  try {
    const entries = await readdir(activityDir())
    const dates = entries
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .filter((name) => DATE_PATTERN.test(name))
    dates.sort((a, b) => b.localeCompare(a))
    return dates
  } catch {
    return []
  }
}
