/**
 * Desktop Activity tracker — the "desktop activity" data connector for the
 * Work Rhythm Module (README §9 Module 1, §17).
 *
 * Cross-platform (macOS / Windows / Linux) foreground-window tracking with
 * idle/break detection, app categorization, work-session derivation and
 * local-first JSON persistence. Detection uses the native `get-windows` module
 * with a per-OS shell fallback; idle state comes from Electron's `powerMonitor`.
 *
 * Typical wiring (main process, after `app.whenReady()`):
 *
 * ```ts
 * const tracker = createActivityTracker()
 * const dispose = registerActivityIpc(ipcMain, tracker, () => BrowserWindow.getAllWindows())
 * app.on('before-quit', () => { void tracker.dispose() })
 * ```
 *
 * The tracker does not start on its own — the renderer starts/stops it via IPC
 * once the module is enabled, keeping the app private by default.
 */
export { createActivityTracker } from './tracker'
export type { ActivityTracker } from './tracker'
export { registerActivityIpc } from './ipc'
export { ACTIVITY_CHANNELS } from './channels'
export {
  DEFAULT_TRACKER_OPTIONS,
  type ActiveWindowSample,
  type AppCategory,
  type AppUsage,
  type BackfillOptions,
  type BackfillResult,
  type DailyUsage,
  type IdleState,
  type TrackerOptions,
  type TrackerStatus,
  type WorkEvent,
  type WorkEventType,
  type WorkSession
} from './types'
