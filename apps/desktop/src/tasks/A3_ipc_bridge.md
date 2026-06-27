# Task A3 — IPC Bridge (Main ↔ Renderer)

**Priority:** CRITICAL — app không chạy được nếu thiếu  
**Model:** Sonnet | **Effort:** think  
**Blocked by:** A2 ✅ (đã xong)  
**Files chính:** `src/main/features/chat/ipc.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`, `src/main/index.ts`

---

## Trạng thái hiện tại (sau khi pull)

| File | Trạng thái |
|---|---|
| `src/main/features/chat/client.ts` | ✅ Xong |
| `src/main/features/chat/types.ts` | ✅ Xong |
| `src/renderer/src/composables/useChat.ts` | ✅ Xong — đang gọi `window.chatAPI` nhưng chưa tồn tại |
| `src/preload/index.ts` | ❌ Vẫn là `api = {}` — chưa expose chatAPI |
| `src/main/features/chat/ipc.ts` | ❌ Chưa có |
| `src/main/index.ts` | ❌ Chưa gọi `registerChatIpcHandlers` |

---

## Lưu ý quan trọng từ code thực tế

`client.ts` đã dùng AI SDK v7 đúng:
- `maxOutputTokens` (không phải `maxTokens`)
- `usage.inputTokens` / `usage.outputTokens` (không phải `promptTokens` / `completionTokens`)

`useChat.ts` import types từ:
```typescript
import type { ChatMessage, DeskMateContext } from '../../../main/features/chat/types'
```
→ `ipc.ts` và `preload` phải import từ cùng path này.

---

## IPC Event Constants — thêm vào `types.ts`

Mở `src/main/features/chat/types.ts` và append:

```typescript
export const CHAT_IPC = {
  SEND:         'chat:send',
  ABORT:        'chat:abort',
  CHUNK:        'chat:chunk',
  DONE:         'chat:done',
  ERROR:        'chat:error',
  HAS_KEY:      'chat:has-key',
  SAVE_KEY:     'chat:save-key',
  VALIDATE_KEY: 'chat:validate-key',
} as const
```

---

## File to Create: `src/main/features/chat/ipc.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { ChatClient } from './client'
import { CHAT_IPC } from './types'
import type { ChatRequest } from './types'

const chatClient = new ChatClient()

// Stub — thay bằng ApiKeyStore từ A5 khi có
let _apiKey: string | null = process.env['OPENAI_API_KEY'] ?? null

export function registerChatIpcHandlers(win: BrowserWindow): void {

  ipcMain.on(CHAT_IPC.SEND, (_event, request: ChatRequest) => {
    if (!_apiKey) {
      win.webContents.send(CHAT_IPC.ERROR, {
        streamId: request.streamId,
        error: 'API key chưa được thiết lập. Vào Cài đặt để thêm key.',
        partialText: '',
      })
      return
    }
    chatClient.stream(_apiKey, request, {
      onChunk: (e) => win.webContents.send(CHAT_IPC.CHUNK, e),
      onDone:  (e) => win.webContents.send(CHAT_IPC.DONE, e),
      onError: (e) => win.webContents.send(CHAT_IPC.ERROR, e),
    })
  })

  ipcMain.on(CHAT_IPC.ABORT, (_event, streamId: string) => {
    chatClient.abort(streamId)
  })

  // Stub handlers — sẽ được thay bằng ApiKeyStore (A5)
  ipcMain.handle(CHAT_IPC.HAS_KEY, () => _apiKey !== null)

  ipcMain.handle(CHAT_IPC.SAVE_KEY, (_event, key: string) => {
    _apiKey = key.trim()
  })

  ipcMain.handle(CHAT_IPC.VALIDATE_KEY, async (_event, key: string) => {
    if (!key.trim().startsWith('sk-')) {
      return { valid: false, error: 'API key phải bắt đầu bằng sk-' }
    }
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key.trim()}` },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok || res.status === 429) return { valid: true }
      if (res.status === 401) return { valid: false, error: 'API key không đúng hoặc đã hết hạn.' }
      return { valid: false, error: `Lỗi HTTP ${res.status}` }
    } catch {
      return { valid: false, error: 'Không thể kết nối đến OpenAI.' }
    }
  })
}

export function cleanupChatIpcHandlers(): void {
  Object.values(CHAT_IPC).forEach((channel) => {
    ipcMain.removeAllListeners(channel)
  })
  chatClient.abortAll()
}
```

---

## File to Modify: `src/preload/index.ts`

Thay toàn bộ file:

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { CHAT_IPC } from '../main/features/chat/types'
import type { ChatRequest, StreamChunkEvent, StreamDoneEvent, StreamErrorEvent } from '../main/features/chat/types'

const chatAPI = {
  send: (request: ChatRequest): void =>
    ipcRenderer.send(CHAT_IPC.SEND, request),

  abort: (streamId: string): void =>
    ipcRenderer.send(CHAT_IPC.ABORT, streamId),

  onChunk: (cb: (event: StreamChunkEvent) => void): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, e: StreamChunkEvent): void => cb(e)
    ipcRenderer.on(CHAT_IPC.CHUNK, fn)
    return () => ipcRenderer.removeListener(CHAT_IPC.CHUNK, fn)
  },

  onDone: (cb: (event: StreamDoneEvent) => void): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, e: StreamDoneEvent): void => cb(e)
    ipcRenderer.on(CHAT_IPC.DONE, fn)
    return () => ipcRenderer.removeListener(CHAT_IPC.DONE, fn)
  },

  onError: (cb: (event: StreamErrorEvent) => void): (() => void) => {
    const fn = (_: Electron.IpcRendererEvent, e: StreamErrorEvent): void => cb(e)
    ipcRenderer.on(CHAT_IPC.ERROR, fn)
    return () => ipcRenderer.removeListener(CHAT_IPC.ERROR, fn)
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

---

## File to Modify: `src/preload/index.d.ts`

Thay toàn bộ file:

```typescript
import { ElectronAPI } from '@electron-toolkit/preload'
import type { ChatRequest, StreamChunkEvent, StreamDoneEvent, StreamErrorEvent } from '../main/features/chat/types'

declare global {
  interface Window {
    electron: ElectronAPI
    chatAPI: {
      send:        (request: ChatRequest) => void
      abort:       (streamId: string) => void
      onChunk:     (cb: (event: StreamChunkEvent) => void) => () => void
      onDone:      (cb: (event: StreamDoneEvent)  => void) => () => void
      onError:     (cb: (event: StreamErrorEvent) => void) => () => void
      hasKey:      () => Promise<boolean>
      saveKey:     (key: string) => Promise<void>
      validateKey: (key: string) => Promise<{ valid: boolean; error?: string }>
    }
  }
}
```

---

## File to Modify: `src/main/index.ts`

Thêm 2 dòng:

```typescript
import { registerChatIpcHandlers, cleanupChatIpcHandlers } from './features/chat/ipc'

// Sau createWindow():
const mainWindow = createWindow()
registerChatIpcHandlers(mainWindow)

// Trong app.on('window-all-closed') hoặc before-quit:
app.on('before-quit', () => cleanupChatIpcHandlers())
```

---

## Cũng cần: Xoá test comment trong `client.ts`

Xoá block comment ở cuối `client.ts`:
```typescript
// TEST — remove before commit
// const client = new ChatClient()
// ...
```

---

## Definition of Done

- [ ] `window.chatAPI` có đủ 7 methods khi inspect trong DevTools
- [ ] `onChunk` / `onDone` / `onError` trả về cleanup function `() => void`
- [ ] Gọi `window.chatAPI.send({...})` từ DevTools → chunks xuất hiện trong main process log
- [ ] `OPENAI_API_KEY` env var hoạt động như fallback key tạm thời
- [ ] `npx tsc --noEmit` không lỗi
- [ ] Test comment đã xoá khỏi `client.ts`
