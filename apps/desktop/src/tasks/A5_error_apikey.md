# Task A5 — API Key Storage & Error Handling

**Priority:** HIGH  
**Model:** Sonnet | **Effort:** think  
**Blocked by:** A1 (cần electron-store đã install)  
**Thư mục:** `apps/desktop/src/main/features/chat/`

## Goal

Lưu API key an toàn trong main process dùng `electron.safeStorage` (mã hoá OS-level).
Validate key bằng một API call nhẹ trước khi dùng.
Xử lý các lỗi phổ biến: key sai, rate limit, network lỗi, stream timeout.

## Files to Create

```
src/main/features/chat/
  api-key-store.ts    ← secure key storage
  error-handler.ts    ← chuẩn hoá error messages
```

## api-key-store.ts

```typescript
// src/main/features/chat/api-key-store.ts
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
    if (!trimmed.startsWith('sk-')) throw new Error('API key không hợp lệ — phải bắt đầu bằng sk-')

    const encrypted = safeStorage.encryptString(trimmed)
    writeFileSync(KEY_FILE, encrypted)
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
      // Dùng models list — call rẻ nhất, không tốn token
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key.trim()}` },
        signal: AbortSignal.timeout(8000),
      })
      if (response.ok) return { valid: true }
      if (response.status === 401) return { valid: false, error: 'API key không đúng hoặc đã hết hạn.' }
      if (response.status === 429) return { valid: true }  // key hợp lệ nhưng đang rate limit
      return { valid: false, error: `Lỗi từ OpenAI: HTTP ${response.status}` }
    } catch (e) {
      return { valid: false, error: 'Không thể kết nối đến OpenAI. Kiểm tra mạng.' }
    }
  }
}
```

## error-handler.ts

```typescript
// src/main/features/chat/error-handler.ts

export interface ChatError {
  code: 'NO_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'TIMEOUT' | 'STREAM_ABORTED' | 'UNKNOWN'
  message: string   // user-facing tiếng Việt
  retryable: boolean
}

export function parseChatError(error: unknown): ChatError {
  if (!(error instanceof Error)) {
    return { code: 'UNKNOWN', message: 'Có lỗi không xác định xảy ra.', retryable: true }
  }

  const msg = error.message.toLowerCase()

  if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('incorrect api key')) {
    return { code: 'INVALID_KEY', message: 'API key không hợp lệ. Vào Cài đặt để cập nhật.', retryable: false }
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return { code: 'RATE_LIMIT', message: 'Đang quá tải, thử lại sau vài giây.', retryable: true }
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { code: 'TIMEOUT', message: 'Kết nối bị timeout. Thử lại nhé.', retryable: true }
  }
  if (msg.includes('abort') || msg.includes('cancel')) {
    return { code: 'STREAM_ABORTED', message: '', retryable: false }  // silent
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('enotfound')) {
    return { code: 'NETWORK', message: 'Không có kết nối mạng.', retryable: true }
  }

  return { code: 'UNKNOWN', message: error.message, retryable: true }
}
```

## Tích hợp vào client.ts (A2)

Trong `catch` block của `ChatClient.stream()`, wrap error qua `parseChatError`:

```typescript
import { parseChatError } from './error-handler'

// Trong catch:
const parsed = parseChatError(error)
if (parsed.code === 'STREAM_ABORTED') return  // silent
callbacks.onError({
  streamId: request.streamId,
  error: parsed.message,
  partialText,
})
```

## Definition of Done

- [ ] `saveKey()` mã hoá bằng `safeStorage` — không lưu plaintext
- [ ] `getKey()` decrypt thành công sau khi app restart
- [ ] `validateKey('sk-invalid')` trả về `{ valid: false, error: '...' }`
- [ ] `validateKey('')` trả về `{ valid: false, error: '...' }`
- [ ] `parseChatError` xử lý đúng 429, 401, network, abort
- [ ] Lỗi `STREAM_ABORTED` không emit về renderer (silent)
- [ ] `deleteKey()` xoá file và reset cache
