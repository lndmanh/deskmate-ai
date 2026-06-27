import { ElectronAPI } from '@electron-toolkit/preload'
import type { ChatRequest, StreamChunkEvent, StreamDoneEvent, StreamErrorEvent } from '../main/features/chat/types'
import type { DeskMateApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: DeskMateApi
    chatAPI: {
      send: (request: ChatRequest) => void
      abort: (streamId: string) => void
      onChunk: (cb: (event: StreamChunkEvent) => void) => () => void
      onDone: (cb: (event: StreamDoneEvent) => void) => () => void
      onError: (cb: (event: StreamErrorEvent) => void) => () => void
      hasKey: () => Promise<boolean>
      saveKey: (key: string) => Promise<void>
      validateKey: (key: string) => Promise<{ valid: boolean; error?: string }>
    }
  }
}
