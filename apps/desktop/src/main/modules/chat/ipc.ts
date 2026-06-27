import type { IpcMain, IpcMainInvokeEvent } from 'electron'

import { CHAT_CHANNELS } from './channels'
import { sendMascotChatMessage } from './service'
import type { MascotChatRequest, MascotChatResponse } from './types'

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

  return { message: trimmed }
}

export function registerChatIpc(ipcMain: IpcMain): () => void {
  ipcMain.handle(
    CHAT_CHANNELS.sendMascotMessage,
    async (_event: IpcMainInvokeEvent, requestArg: unknown): Promise<MascotChatResponse> => {
      const request = toMascotChatRequest(requestArg)
      if (!request) {
        throw new Error('Message is required')
      }

      return sendMascotChatMessage(request)
    }
  )

  return () => {
    ipcMain.removeHandler(CHAT_CHANNELS.sendMascotMessage)
  }
}
