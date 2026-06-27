import { ElectronAPI } from '@electron-toolkit/preload'
import type { ChatRequest, StreamChunkEvent, StreamDoneEvent, StreamErrorEvent } from '../main/features/chat/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
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
