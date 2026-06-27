import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron'
import { ACTIVITY_CHANNELS } from './channels'
import type { ActivityTracker } from './tracker'
import type { BackfillOptions, DailyUsage } from './types'

function toBackfillOptions(value: unknown): BackfillOptions {
  if (typeof value !== 'object' || value === null) {
    return {}
  }
  const options: BackfillOptions = {}
  const maxDays = Reflect.get(value, 'maxDays')
  if (typeof maxDays === 'number') {
    options.maxDays = maxDays
  }
  const overwrite = Reflect.get(value, 'overwrite')
  if (typeof overwrite === 'boolean') {
    options.overwrite = overwrite
  }
  return options
}

/**
 * Wire the tracker to IPC: invoke handlers for control/queries, plus pushed
 * `update`/`event` messages broadcast to every renderer window.
 *
 * @param getWindows resolves the live set of windows to broadcast to.
 * @returns a disposer that removes all handlers and listeners.
 */
export function registerActivityIpc(
  ipcMain: IpcMain,
  tracker: ActivityTracker,
  getWindows: () => BrowserWindow[]
): () => void {
  const broadcast = (channel: string, payload: unknown): void => {
    for (const window of getWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, payload)
      }
    }
  }

  ipcMain.handle(ACTIVITY_CHANNELS.start, () => tracker.start())
  ipcMain.handle(ACTIVITY_CHANNELS.stop, () => tracker.stop())
  ipcMain.handle(ACTIVITY_CHANNELS.status, () => tracker.getStatus())
  ipcMain.handle(ACTIVITY_CHANNELS.getToday, () => tracker.getToday())
  ipcMain.handle(ACTIVITY_CHANNELS.listDays, () => tracker.listDays())
  ipcMain.handle(ACTIVITY_CHANNELS.backfillSupport, () => tracker.isBackfillSupported())
  ipcMain.handle(ACTIVITY_CHANNELS.openPermission, () => tracker.openHistoryPermission())
  ipcMain.handle(ACTIVITY_CHANNELS.backfill, (_event: IpcMainInvokeEvent, optionsArg: unknown) =>
    tracker.backfill(toBackfillOptions(optionsArg))
  )
  ipcMain.handle(
    ACTIVITY_CHANNELS.getDay,
    (_event: IpcMainInvokeEvent, dateArg: unknown): Promise<DailyUsage | null> => {
      if (typeof dateArg === 'string') {
        return tracker.getDay(dateArg)
      }
      return Promise.resolve(tracker.getToday())
    }
  )

  const offUpdate = tracker.onUpdate((status) => broadcast(ACTIVITY_CHANNELS.update, status))
  const offEvent = tracker.onEvent((event) => broadcast(ACTIVITY_CHANNELS.event, event))

  return () => {
    offUpdate()
    offEvent()
    ipcMain.removeHandler(ACTIVITY_CHANNELS.start)
    ipcMain.removeHandler(ACTIVITY_CHANNELS.stop)
    ipcMain.removeHandler(ACTIVITY_CHANNELS.status)
    ipcMain.removeHandler(ACTIVITY_CHANNELS.getToday)
    ipcMain.removeHandler(ACTIVITY_CHANNELS.listDays)
    ipcMain.removeHandler(ACTIVITY_CHANNELS.getDay)
    ipcMain.removeHandler(ACTIVITY_CHANNELS.backfill)
    ipcMain.removeHandler(ACTIVITY_CHANNELS.backfillSupport)
    ipcMain.removeHandler(ACTIVITY_CHANNELS.openPermission)
  }
}
