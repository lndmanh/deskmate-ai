# Task A4 — Renderer Chat Util (Vue Composable)

**Priority:** HIGH  
**Model:** Sonnet | **Effort:** think  
**Blocked by:** A3  
**Thư mục:** `apps/desktop/src/renderer/src/`

## Goal

Tạo composable `useChat` và util `conversationStore` để renderer có thể:
- Gửi message và nhận streaming response
- Quản lý message history
- Huỷ stream đang chạy
- Lưu/load conversation từ localStorage

Chưa cần tích hợp UI — đây là logic layer thuần.

## Files to Create

```
src/renderer/src/
  composables/
    useChat.ts          ← Vue composable chính
  lib/
    conversation.ts     ← message history manager
    stream-id.ts        ← uuid generator
```

## stream-id.ts

```typescript
// src/renderer/src/lib/stream-id.ts
export function generateStreamId(): string {
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
```

## conversation.ts

```typescript
// src/renderer/src/lib/conversation.ts
import type { ChatMessage } from '../../../../main/features/chat/types'

const STORAGE_KEY = 'deskmate_conversation'
const MAX_HISTORY = 20  // giữ tối đa 20 messages để tránh context quá dài

export function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatMessage[]) : []
  } catch {
    return []
  }
}

export function saveMessages(messages: ChatMessage[]): void {
  const trimmed = messages.slice(-MAX_HISTORY)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function clearMessages(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function appendMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...messages, message].slice(-MAX_HISTORY)
}
```

## useChat.ts

```typescript
// src/renderer/src/composables/useChat.ts
import { ref, readonly } from 'vue'
import type { Ref } from 'vue'
import type { ChatMessage, DeskMateContext } from '../../../../main/features/chat/types'
import { generateStreamId } from '../lib/stream-id'
import { loadMessages, saveMessages, clearMessages, appendMessage } from '../lib/conversation'

export interface UseChatReturn {
  messages: Readonly<Ref<ChatMessage[]>>
  streamingText: Readonly<Ref<string>>
  isStreaming: Readonly<Ref<boolean>>
  tokenUsage: Readonly<Ref<{ input: number; output: number; total: number } | null>>
  send: (userText: string, context?: DeskMateContext) => void
  abort: () => void
  clear: () => void
}

export function useChat(): UseChatReturn {
  const messages = ref<ChatMessage[]>(loadMessages())
  const streamingText = ref('')
  const isStreaming = ref(false)
  const tokenUsage = ref<{ input: number; output: number; total: number } | null>(null)
  let currentStreamId: string | null = null
  let cleanupFns: Array<() => void> = []

  function clearListeners(): void {
    cleanupFns.forEach((fn) => fn())
    cleanupFns = []
  }

  function send(userText: string, context?: DeskMateContext): void {
    if (isStreaming.value) abort()

    const userMessage: ChatMessage = { role: 'user', content: userText }
    messages.value = appendMessage(messages.value, userMessage)
    saveMessages(messages.value)

    streamingText.value = ''
    isStreaming.value = true
    tokenUsage.value = null
    currentStreamId = generateStreamId()

    // Register listeners before sending — avoid race condition
    cleanupFns.push(
      window.chatAPI.onChunk((event) => {
        if (event.streamId !== currentStreamId) return
        streamingText.value += event.delta
      }),
      window.chatAPI.onDone((event) => {
        if (event.streamId !== currentStreamId) return
        // Commit streaming text as assistant message
        const assistantMessage: ChatMessage = { role: 'assistant', content: streamingText.value }
        messages.value = appendMessage(messages.value, assistantMessage)
        saveMessages(messages.value)
        streamingText.value = ''
        isStreaming.value = false
        tokenUsage.value = { input: event.inputTokens, output: event.outputTokens, total: event.totalTokens }
        clearListeners()
      }),
      window.chatAPI.onError((event) => {
        if (event.streamId !== currentStreamId) return
        // Keep partial text as error message
        if (event.partialText) {
          const partial: ChatMessage = { role: 'assistant', content: event.partialText + '\n\n⚠️ Stream bị ngắt.' }
          messages.value = appendMessage(messages.value, partial)
          saveMessages(messages.value)
        }
        streamingText.value = ''
        isStreaming.value = false
        clearListeners()
      }),
    )

    window.chatAPI.send({
      streamId: currentStreamId,
      messages: messages.value,
      context,
    })
  }

  function abort(): void {
    if (currentStreamId) {
      window.chatAPI.abort(currentStreamId)
      currentStreamId = null
    }
    streamingText.value = ''
    isStreaming.value = false
    clearListeners()
  }

  function clear(): void {
    abort()
    messages.value = []
    clearMessages()
  }

  return {
    messages: readonly(messages),
    streamingText: readonly(streamingText),
    isStreaming: readonly(isStreaming),
    tokenUsage: readonly(tokenUsage),
    send,
    abort,
    clear,
  }
}
```

## Definition of Done

- [ ] `useChat()` trả về đúng 6 fields
- [ ] `send()` append user message trước khi stream bắt đầu
- [ ] `streamingText` accumulate đúng từng chunk
- [ ] `onDone` commit `streamingText` thành assistant message và reset
- [ ] `onError` giữ lại partial text, đánh dấu ⚠️
- [ ] `clear()` xoá localStorage và reset state
- [ ] Listener cleanup được gọi sau mỗi `done` / `error` / `abort` — không leak
- [ ] Test trong DevTools console: `window.useChat` không khả dụng (đây là composable, không phải global)
