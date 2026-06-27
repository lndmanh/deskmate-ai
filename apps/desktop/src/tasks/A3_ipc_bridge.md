# Task A3 — IPC Bridge (Main ↔ Renderer)

**Priority:** CRITICAL  
**Model:** Sonnet | **Effort:** think  
**Blocked by:** A2  
**Files chính:** `src/main/features/chat/ipc.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`

## Goal

Kết nối `ChatClient` (main process) với renderer qua Electron IPC.  
Renderer gọi `window.chatAPI.send()` → main process stream → renderer nhận chunks qua `window.chatAPI.onChunk()`.

## IPC Event Names

```typescript
// Dùng constants để tránh typo
export const CHAT_IPC = {
  SEND:         'chat:send',         // renderer → main
  ABORT:        'chat:abort',        // renderer → main
  CHUNK:        'chat:chunk',        // main → renderer
  DONE:         'chat:done',         // main → renderer
  ERROR:        'chat:error',        // main → renderer
  VALIDATE_KEY: 'chat:validate-key', // renderer → main (two-way invoke)
  SAVE_KEY:     'chat:save-key',     // renderer → main (two-way invoke)
  HAS_KEY:      'chat:has-key',      // renderer → main (two-way invoke)
} as const
```

## Files to Create

```
src/main/features/chat/
  ipc.ts        ← registerChatIpcHandlers()
```

## Files to Modify

```
src/main/index.ts       ← call registerChatIpcHandlers(mainWindow)
src/preload/index.ts    ← expose chatAPI to renderer
src/preload/index.d.ts  ← add Window.chatAPI types
```

## ipc.ts

```typescript
// src/main/features/chat/ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import { ChatClient } from './client'
import { ApiKeyStore } from './api-key-store'   // từ Task A5
import { CHAT_IPC } from './types'
import type { ChatRequest } from './types'

const chatClient = new ChatClient()
const keyStore = new ApiKeyStore()

export function registerChatIpcHandlers(win: BrowserWindow): void {

  // renderer → main: start a new stream
  ipcMain.on(CHAT_IPC.SEND, async (_event, request: ChatRequest) => {
    const apiKey = keyStore.getKey()
    if (!apiKey) {
      win.webContents.send(CHAT_IPC.ERROR, {
        streamId: request.streamId,
        error: 'API key chưa được thiết lập.',
        partialText: '',
      })
      return
    }

    await chatClient.stream(apiKey, request, {
      onChunk: (event) => win.webContents.send(CHAT_IPC.CHUNK, event),
      onDone:  (event) => win.webContents.send(CHAT_IPC.DONE, event),
      onError: (event) => win.webContents.send(CHAT_IPC.ERROR, event),
    })
  })

  // renderer → main: abort stream
  ipcMain.on(CHAT_IPC.ABORT, (_event, streamId: string) => {
    chatClient.abort(streamId)
  })

  // renderer → main: check if key exists (invoke = two-way)
  ipcMain.handle(CHAT_IPC.HAS_KEY, () => keyStore.hasKey())

  // renderer → main: save key
  ipcMain.handle(CHAT_IPC.SAVE_KEY, (_event, key: string) => keyStore.saveKey(key))

  // renderer → main: validate key by making a cheap API call
  ipcMain.handle(CHAT_IPC.VALIDATE_KEY, async (_event, key: string) => {
    return keyStore.validateKey(key)  // implemented in A5
  })
}
```

## preload/index.ts — Replace the empty `api` object

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { CHAT_IPC } from '../main/features/chat/types'
import type { ChatRequest, StreamChunkEvent, StreamDoneEvent, StreamErrorEvent } from '../main/features/chat/types'

const chatAPI = {
  send: (request: ChatRequest) =>
    ipcRenderer.send(CHAT_IPC.SEND, request),

  abort: (streamId: string) =>
    ipcRenderer.send(CHAT_IPC.ABORT, streamId),

  onChunk: (cb: (event: StreamChunkEvent) => void) => {
    const handler = (_: unknown, event: StreamChunkEvent) => cb(event)
    ipcRenderer.on(CHAT_IPC.CHUNK, handler)
    return () => ipcRenderer.removeListener(CHAT_IPC.CHUNK, handler)   // cleanup fn
  },

  onDone: (cb: (event: StreamDoneEvent) => void) => {
    const handler = (_: unknown, event: StreamDoneEvent) => cb(event)
    ipcRenderer.on(CHAT_IPC.DONE, handler)
    return () => ipcRenderer.removeListener(CHAT_IPC.DONE, handler)
  },

  onError: (cb: (event: StreamErrorEvent) => void) => {
    const handler = (_: unknown, event: StreamErrorEvent) => cb(event)
    ipcRenderer.on(CHAT_IPC.ERROR, handler)
    return () => ipcRenderer.removeListener(CHAT_IPC.ERROR, handler)
  },

  hasKey: (): Promise<boolean> =>
    ipcRenderer.invoke(CHAT_IPC.HAS_KEY),

  saveKey: (key: string): Promise<void> =>
    ipcRenderer.invoke(CHAT_IPC.SAVE_KEY, key),

  validateKey: (key: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke(CHAT_IPC.VALIDATE_KEY, key),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('chatAPI', chatAPI)
  } catch (e) {
    console.error(e)
  }
} else {
  window.electron = electronAPI
  window.chatAPI = chatAPI
}
```

## preload/index.d.ts

```typescript
import { ElectronAPI } from '@electron-toolkit/preload'
import type { ChatRequest, StreamChunkEvent, StreamDoneEvent, StreamErrorEvent } from '../main/features/chat/types'

declare global {
  interface Window {
    electron: ElectronAPI
    chatAPI: {
      send: (request: ChatRequest) => void
      abort: (streamId: string) => void
      onChunk: (cb: (event: StreamChunkEvent) => void) => () => void
      onDone:  (cb: (event: StreamDoneEvent)  => void) => () => void
      onError: (cb: (event: StreamErrorEvent) => void) => () => void
      hasKey:     () => Promise<boolean>
      saveKey:    (key: string) => Promise<void>
      validateKey:(key: string) => Promise<{ valid: boolean; error?: string }>
    }
  }
}
```

## src/main/index.ts — Add one line after createWindow()

```typescript
import { registerChatIpcHandlers } from './features/chat/ipc'

// Inside app.whenReady():
const mainWindow = createWindow()
registerChatIpcHandlers(mainWindow)
```

## Definition of Done

- [ ] `window.chatAPI` có đầy đủ 7 methods trong renderer DevTools console
- [ ] `onChunk` / `onDone` / `onError` đều trả về cleanup function (không leak listeners)
- [ ] Gọi `window.chatAPI.send({...})` từ DevTools → thấy chunks log trong main process
- [ ] `npx tsc --noEmit` không lỗi
