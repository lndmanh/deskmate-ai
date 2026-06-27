# Task A5 — API Key Storage & Error Handling

**Priority:** Nên có trước khi demo  
**Model:** Sonnet | **Effort:** think  
**Blocked by:** A3 ✅ (stub key đã có trong ipc.ts)  
**Thư mục:** `src/main/features/chat/`

## Trạng thái hiện tại

A3 đã có stub tạm thời:
- Key lưu trong biến `_apiKey` trong memory (mất khi restart)
- `OPENAI_API_KEY` env var dùng làm fallback

Task này thay stub bằng storage thật dùng `electron.safeStorage`.

---

## Files to Create

```
src/main/features/chat/
  api-key-store.ts
  error-handler.ts
```

## api-key-store.ts

```typescript
import { safeStorage, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'

const KEY_FILE = join(app.getPath('userData'), '.deskmate_key')

export class ApiKeyStore {
  private cachedKey: string | null = null

  hasKey(): boolean {
    return existsSync(KEY_FILE) || this.cachedKey !== null
  }

  getKey(): string | null {
    if (this.cachedKey) return this.cachedKey
    if (!existsSync(KEY_FILE)) return null
    try {
      const encrypted = readFileSync(KEY_FILE)
      this.cachedKey = safeStorage.decryptString(encrypted)
      return this.cachedKey
    } catch {
      return null
    }
  }

  saveKey(key: string): void {
    const trimmed = key.trim()
    if (!trimmed.startsWith('sk-')) throw new Error('API key không hợp lệ')
    if (safeStorage.isEncryptionAvailable()) {
      writeFileSync(KEY_FILE, safeStorage.encryptString(trimmed))
    } else {
      console.warn('[ApiKeyStore] safeStorage không khả dụng — lưu plaintext')
      writeFileSync(KEY_FILE, trimmed, 'utf-8')
    }
    this.cachedKey = trimmed
  }

  deleteKey(): void {
    if (existsSync(KEY_FILE)) unlinkSync(KEY_FILE)
    this.cachedKey = null
  }

  async validateKey(key: string): Promise<{ valid: boolean; error?: string }> {
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
  }
}
```

## error-handler.ts

```typescript
export interface ChatError {
  code: 'NO_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'TIMEOUT' | 'STREAM_ABORTED' | 'UNKNOWN'
  message: string
  retryable: boolean
}

export function parseChatError(error: unknown): ChatError {
  if (!(error instanceof Error)) {
    return { code: 'UNKNOWN', message: 'Có lỗi không xác định xảy ra.', retryable: true }
  }
  const msg = error.message.toLowerCase()
  if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('incorrect api key'))
    return { code: 'INVALID_KEY', message: 'API key không hợp lệ. Vào Cài đặt để cập nhật.', retryable: false }
  if (msg.includes('429') || msg.includes('rate limit'))
    return { code: 'RATE_LIMIT', message: 'Đang quá tải, thử lại sau vài giây.', retryable: true }
  if (msg.includes('timeout') || msg.includes('timed out'))
    return { code: 'TIMEOUT', message: 'Kết nối bị timeout. Thử lại nhé.', retryable: true }
  if (msg.includes('abort') || msg.includes('cancel'))
    return { code: 'STREAM_ABORTED', message: '', retryable: false }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('enotfound'))
    return { code: 'NETWORK', message: 'Không có kết nối mạng.', retryable: true }
  return { code: 'UNKNOWN', message: error.message, retryable: true }
}
```

## Cập nhật `ipc.ts` sau khi A5 xong

Thay stub trong `ipc.ts`:

```typescript
// Xoá:
let _apiKey: string | null = process.env['OPENAI_API_KEY'] ?? null

// Thêm:
import { ApiKeyStore } from './api-key-store'
const keyStore = new ApiKeyStore()

// Trong SEND handler:
const apiKey = keyStore.getKey() ?? process.env['OPENAI_API_KEY'] ?? null

// Thay stub handles:
ipcMain.handle(CHAT_IPC.HAS_KEY, () => keyStore.hasKey())
ipcMain.handle(CHAT_IPC.SAVE_KEY, (_e, key: string) => keyStore.saveKey(key))
ipcMain.handle(CHAT_IPC.VALIDATE_KEY, (_e, key: string) => keyStore.validateKey(key))
```

Cập nhật `client.ts` — trong catch block:

```typescript
import { parseChatError } from './error-handler'

// Trong catch:
const parsed = parseChatError(error)
if (parsed.code === 'STREAM_ABORTED') return
callbacks.onError({ streamId: request.streamId, error: parsed.message, partialText })
```

## Definition of Done

- [ ] Key persist sau khi restart app
- [ ] `safeStorage` fallback plaintext nếu Linux không hỗ trợ
- [ ] `validateKey('sk-invalid')` → `{ valid: false, error: '...' }`
- [ ] `parseChatError` trả về message tiếng Việt cho 401/429/timeout/network
- [ ] Lỗi abort = silent (không emit về renderer)
