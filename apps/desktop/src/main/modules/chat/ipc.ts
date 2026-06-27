import type { IpcMain, IpcMainInvokeEvent } from 'electron'

import { CHAT_CHANNELS } from './channels'
import { sendMascotChatMessage } from './service'
import type { ActivityTracker, DailyUsage, TrackerStatus } from '../activity-tracker'
import type {
  MascotChatContext,
  MascotChatHistoryMessage,
  MascotChatRequest,
  MascotChatResponse
} from './types'

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 60 * MS_PER_MINUTE

function toMascotChatRequest(value: unknown): MascotChatRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const message: unknown = Reflect.get(value, 'message')
  if (typeof message !== 'string') {
    return null
  }

  const trimmed = message.trim()
  if (!trimmed) {
    return null
  }

  return { message: trimmed, history: toMascotChatHistory(Reflect.get(value, 'history')) }
}

function toMascotChatHistory(value: unknown): MascotChatHistoryMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  const messages: MascotChatHistoryMessage[] = []

  for (const item of value.slice(-8)) {
    const message = toMascotChatHistoryMessage(item)
    if (message) {
      messages.push(message)
    }
  }

  return messages
}

function toMascotChatHistoryMessage(value: unknown): MascotChatHistoryMessage | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const role = Reflect.get(value, 'role')
  const content = Reflect.get(value, 'content')

  if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
    return null
  }

  const trimmed = content.trim()
  if (!trimmed) {
    return null
  }

  return { role, content: trimmed }
}

export function registerChatIpc(ipcMain: IpcMain, activityTracker: ActivityTracker): () => void {
  ipcMain.handle(
    CHAT_CHANNELS.sendMascotMessage,
    async (_event: IpcMainInvokeEvent, requestArg: unknown): Promise<MascotChatResponse> => {
      const request = toMascotChatRequest(requestArg)
      if (!request) {
        throw new Error('Message is required')
      }

      return sendMascotChatMessage(request, buildMascotChatContext(activityTracker))
    }
  )

  return () => {
    ipcMain.removeHandler(CHAT_CHANNELS.sendMascotMessage)
  }
}

function buildMascotChatContext(activityTracker: ActivityTracker): MascotChatContext {
  const status = activityTracker.getStatus()
  const today = activityTracker.getToday()
  const longestSessionMinutes = Math.round(today.longestSessionMs / MS_PER_MINUTE)
  const currentSessionMinutes = Math.round(status.currentSessionMs / MS_PER_MINUTE)

  return {
    activeTime: formatDuration(today.activeMs),
    longestSession: longestSessionMinutes > 0 ? `${longestSessionMinutes} phút` : null,
    currentSessionMinutes: currentSessionMinutes > 0 ? currentSessionMinutes : null,
    breakCount: today.breakCount,
    extraEvents: buildActivityEvents(status, today)
  }
}

function buildActivityEvents(status: TrackerStatus, today: DailyUsage): string[] {
  const events: string[] = []

  events.push(
    status.running
      ? 'Activity tracker đang chạy trong desktop app.'
      : 'Activity tracker chưa chạy trong desktop app.'
  )

  if (status.currentApp) {
    events.push(`App hiện tại: ${status.currentApp}.`)
  }

  if (today.sessions.length > 0) {
    events.push(`Hôm nay đã ghi nhận ${today.sessions.length} work session.`)
  } else if (today.activeMs > 0) {
    events.push('Hôm nay đã có active time nhưng chưa đóng work session nào.')
  } else {
    events.push('Hôm nay chưa có activity data được ghi nhận.')
  }

  return events
}

function formatDuration(milliseconds: number): string {
  if (milliseconds <= 0) {
    return '0 phút'
  }

  const hours = Math.floor(milliseconds / MS_PER_HOUR)
  const minutes = Math.round((milliseconds % MS_PER_HOUR) / MS_PER_MINUTE)

  if (hours <= 0) {
    return `${minutes} phút`
  }

  if (minutes <= 0) {
    return `${hours} giờ`
  }

  return `${hours} giờ ${minutes} phút`
}
