// src/renderer/src/composables/useChat.ts
import { ref, readonly } from 'vue'
import type { Ref } from 'vue'
import type { ChatMessage, DeskMateContext } from '../../../main/features/chat/types'
import { generateStreamId } from '../lib/stream-id'
import { loadMessages, saveMessages, clearMessages, appendMessage } from '../lib/conversation'

export interface UseChatReturn {
  messages: Readonly<Ref<readonly ChatMessage[]>>
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
