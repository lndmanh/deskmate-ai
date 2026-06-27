import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ACTIVITY_CHANNELS } from '../main/modules/activity-tracker/channels'
import { CHAT_CHANNELS } from '../main/modules/chat/channels'
import type {
  BackfillOptions,
  BackfillResult,
  DailyUsage,
  TrackerStatus,
  WorkEvent
} from '../main/modules/activity-tracker/types'
import type { MascotChatRequest, MascotChatResponse } from '../main/modules/chat/types'

export interface ActivityApi {
  /** Begin tracking; resolves with the resulting status. */
  start(): Promise<TrackerStatus>
  /** Stop tracking and flush the current day. */
  stop(): Promise<TrackerStatus>
  /** Current live tracker status. */
  status(): Promise<TrackerStatus>
  /** Today's rollup (sessions, breaks, per-app screen time). */
  getToday(): Promise<DailyUsage>
  /** A specific day's rollup (YYYY-MM-DD), or null when absent. */
  getDay(date: string): Promise<DailyUsage | null>
  /** Dates that have stored rollups, newest first. */
  listDays(): Promise<string[]>
  /** Import historical days from macOS Screen Time. */
  backfill(options?: BackfillOptions): Promise<BackfillResult>
  /** Whether historical backfill is available on this platform. */
  backfillSupport(): Promise<boolean>
  /** Open the OS permission pane needed for backfill (macOS Full Disk Access). */
  openHistoryPermission(): Promise<void>
  /** Subscribe to throttled status pushes; returns an unsubscribe function. */
  onUpdate(callback: (status: TrackerStatus) => void): () => void
  /** Subscribe to structured work events; returns an unsubscribe function. */
  onEvent(callback: (event: WorkEvent) => void): () => void
}

export interface OnboardingApi {
  read(): Promise<unknown | null>
  write(data: unknown): Promise<{ path: string }>
  clear(): Promise<{ path: string }>
  getPath(): Promise<string>
}

export interface DeskMateApi {
  activity: ActivityApi
  mascotChat: MascotChatApi
  onboarding: OnboardingApi
}

export interface MascotChatApi {
  sendMessage(request: MascotChatRequest): Promise<MascotChatResponse>
}

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => {
    callback(payload)
  }
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const activity: ActivityApi = {
  start: () => ipcRenderer.invoke(ACTIVITY_CHANNELS.start),
  stop: () => ipcRenderer.invoke(ACTIVITY_CHANNELS.stop),
  status: () => ipcRenderer.invoke(ACTIVITY_CHANNELS.status),
  getToday: () => ipcRenderer.invoke(ACTIVITY_CHANNELS.getToday),
  getDay: (date) => ipcRenderer.invoke(ACTIVITY_CHANNELS.getDay, date),
  listDays: () => ipcRenderer.invoke(ACTIVITY_CHANNELS.listDays),
  backfill: (options) => ipcRenderer.invoke(ACTIVITY_CHANNELS.backfill, options),
  backfillSupport: () => ipcRenderer.invoke(ACTIVITY_CHANNELS.backfillSupport),
  openHistoryPermission: () => ipcRenderer.invoke(ACTIVITY_CHANNELS.openPermission),
  onUpdate: (callback) => subscribe(ACTIVITY_CHANNELS.update, callback),
  onEvent: (callback) => subscribe(ACTIVITY_CHANNELS.event, callback)
}

const mascotChat: MascotChatApi = {
  sendMessage: (request) => ipcRenderer.invoke(CHAT_CHANNELS.sendMascotMessage, request)
}

const onboarding: OnboardingApi = {
  read: () => ipcRenderer.invoke('onboarding:read'),
  write: (data) => ipcRenderer.invoke('onboarding:write', data),
  clear: () => ipcRenderer.invoke('onboarding:clear'),
  getPath: () => ipcRenderer.invoke('onboarding:path')
}

// Custom APIs for renderer
const api: DeskMateApi = { activity, mascotChat, onboarding }

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
