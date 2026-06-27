/**
 * IPC channel names for the activity tracker.
 *
 * Kept dependency-free so both the main process (`ipc.ts`) and the preload
 * bridge can import it without dragging the tracker implementation into the
 * preload bundle.
 */
export const ACTIVITY_CHANNELS = {
  // renderer → main (invoke)
  start: 'activity:start',
  stop: 'activity:stop',
  status: 'activity:status',
  getToday: 'activity:get-today',
  getDay: 'activity:get-day',
  listDays: 'activity:list-days',
  backfill: 'activity:backfill',
  backfillSupport: 'activity:backfill-support',
  openPermission: 'activity:open-permission',
  // main → renderer (send)
  update: 'activity:update',
  event: 'activity:event'
}
