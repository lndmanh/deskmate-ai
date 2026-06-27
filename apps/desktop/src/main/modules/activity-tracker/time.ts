/** Small time helpers shared across the activity-tracker module. */

/** Local calendar day for an epoch-ms timestamp, formatted YYYY-MM-DD. */
export function localDateKey(at: number): string {
  const date = new Date(at)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Epoch ms for the last instant (23:59:59.999) of the local day containing `at`. */
export function endOfLocalDayMs(at: number): number {
  const date = new Date(at)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}
