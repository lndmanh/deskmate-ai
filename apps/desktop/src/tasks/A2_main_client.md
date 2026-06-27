# Task A2 — Main Process Chat Client

**Priority:** CRITICAL  
**Model:** Opus | **Effort:** ultrathink  
**Blocked by:** A1  
**Thư mục:** `apps/desktop/src/main/features/chat/`

## Goal

Xây dựng `ChatClient` trong main process — gọi `streamText`, stream chunks ra ngoài qua callback, inject DeskMate context vào system prompt. Đây là core logic của toàn bộ feature.

## Files to Create

```
src/main/features/chat/
  client.ts           ← ChatClient class
  system-prompt.ts    ← DeskMate-aware system prompt builder
```

## system-prompt.ts

```typescript
// src/main/features/chat/system-prompt.ts
import type { DeskMateContext } from './types'

const BASE_SYSTEM_PROMPT = `
Bạn là DeskMate Coach, trợ lý AI cá nhân tích hợp trong ứng dụng DeskMate.
Bạn có thể nhận thông tin về tư thế, thời gian làm việc và trạng thái mệt mỏi của người dùng.

Quy tắc:
- Trả lời bằng tiếng Việt tự nhiên, thân thiện, ngắn gọn
- Không chẩn đoán bệnh, không dùng từ y tế chắc chắn
- Dựa vào dữ liệu được cung cấp, không suy đoán thêm
- Nếu không có dữ liệu context, trả lời chung mà không bịa số liệu
`.trim()

export function buildSystemPrompt(context?: DeskMateContext): string {
  if (!context) return BASE_SYSTEM_PROMPT

  const lines: string[] = [BASE_SYSTEM_PROMPT, '', '--- Trạng thái hiện tại của người dùng ---']

  if (context.postureStatus) lines.push(`Tư thế: ${context.postureStatus}`)
  if (context.postureScore !== undefined) lines.push(`Điểm tư thế: ${context.postureScore}/100`)
  if (context.breakDebt) lines.push(`Nợ nghỉ: ${context.breakDebt}`)
  if (context.fatigueRisk) lines.push(`Nguy cơ mệt: ${context.fatigueRisk}`)
  if (context.activeTimeMinutes !== undefined) lines.push(`Thời gian làm việc hôm nay: ${context.activeTimeMinutes} phút`)
  if (context.latestMood) lines.push(`Tâm trạng self-report: ${context.latestMood}`)

  lines.push('--- Hết context ---')
  return lines.join('\n')
}
```

## client.ts

```typescript
// src/main/features/chat/client.ts
import { streamText } from 'ai'
import { createOpenAIClient, CHAT_CONFIG } from './config'
import { buildSystemPrompt } from './system-prompt'
import type { ChatMessage, ChatRequest, StreamChunkEvent, StreamDoneEvent, StreamErrorEvent } from './types'

export type StreamCallbacks = {
  onChunk: (event: StreamChunkEvent) => void
  onDone: (event: StreamDoneEvent) => void
  onError: (event: StreamErrorEvent) => void
}

export class ChatClient {
  private activeControllers = new Map<string, AbortController>()

  async stream(apiKey: string, request: ChatRequest, callbacks: StreamCallbacks): Promise<void> {
    // Abort any existing stream with same streamId
    this.abort(request.streamId)

    const controller = new AbortController()
    this.activeControllers.set(request.streamId, controller)

    const openai = createOpenAIClient(apiKey)
    const systemPrompt = buildSystemPrompt(request.context)

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...request.messages,
    ]

    let partialText = ''

    try {
      const result = streamText({
        model: openai(CHAT_CONFIG.model),
        messages,
        maxTokens: CHAT_CONFIG.maxTokens,
        temperature: CHAT_CONFIG.temperature,
        abortSignal: controller.signal,
      })

      for await (const chunk of result.textStream) {
        if (controller.signal.aborted) break
        partialText += chunk
        callbacks.onChunk({ streamId: request.streamId, delta: chunk })
      }

      // Await final metadata
      const usage = await result.usage
      const finishReason = await result.finishReason

      callbacks.onDone({
        streamId: request.streamId,
        finishReason: finishReason ?? 'stop',
        totalTokens: usage.totalTokens,
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
      })
    } catch (error) {
      if (controller.signal.aborted) return // User-initiated abort — silent

      const message = error instanceof Error ? error.message : String(error)
      callbacks.onError({
        streamId: request.streamId,
        error: message,
        partialText,
      })
    } finally {
      this.activeControllers.delete(request.streamId)
    }
  }

  abort(streamId: string): void {
    const controller = this.activeControllers.get(streamId)
    if (controller) {
      controller.abort()
      this.activeControllers.delete(streamId)
    }
  }

  abortAll(): void {
    this.activeControllers.forEach((c) => c.abort())
    this.activeControllers.clear()
  }
}
```

## Definition of Done

- [ ] `ChatClient.stream()` emits `onChunk` cho mỗi `textDelta`
- [ ] `abort(streamId)` dừng stream ngay, không emit thêm chunk
- [ ] `buildSystemPrompt()` inject đúng context fields, bỏ qua field `undefined`
- [ ] `onError` nhận được `partialText` đã nhận trước khi lỗi
- [ ] Không có `any` type nào trong cả 2 file
- [ ] Test thủ công: gọi `stream()` với key thật, xem chunks log ra console
