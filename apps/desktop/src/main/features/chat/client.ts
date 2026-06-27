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
    // Abort any existing stream with the same streamId before starting a new one.
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
        maxOutputTokens: CHAT_CONFIG.maxTokens,
        temperature: CHAT_CONFIG.temperature,
        abortSignal: controller.signal,
      })

      for await (const chunk of result.textStream) {
        if (controller.signal.aborted) break
        partialText += chunk
        callbacks.onChunk({ streamId: request.streamId, delta: chunk })
      }

      // A mid-stream abort is user-initiated: return silently without emitting onDone.
      if (controller.signal.aborted) return

      // Await final metadata once the text stream has drained.
      const usage = await result.usage
      const finishReason = await result.finishReason

      callbacks.onDone({
        streamId: request.streamId,
        finishReason,
        totalTokens: usage.totalTokens ?? 0,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      })
    } catch (error) {
      if (controller.signal.aborted) return // User-initiated abort — silent.

      const message = error instanceof Error ? error.message : String(error)
      callbacks.onError({
        streamId: request.streamId,
        error: message,
        partialText,
      })
    } finally {
      // Only clear our own controller. A same-streamId restart may have already
      // replaced it in the map; deleting unconditionally would untrack the new stream.
      if (this.activeControllers.get(request.streamId) === controller) {
        this.activeControllers.delete(request.streamId)
      }
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

// TEST — remove before commit
// const client = new ChatClient()
// client.stream('sk-test', { streamId: 'x', messages: [{ role: 'user', content: 'ping' }] }, {
//   onChunk: (e) => console.log('chunk:', e.delta),
//   onDone: (e) => console.log('done:', e),
//   onError: (e) => console.error('error:', e),
// })
