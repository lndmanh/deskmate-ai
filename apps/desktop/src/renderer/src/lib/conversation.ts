// src/renderer/src/lib/conversation.ts
import type { ChatMessage } from '../../../main/features/chat/types'

const STORAGE_KEY = 'deskmate_conversation'
const MAX_HISTORY = 20 // giữ tối đa 20 messages để tránh context quá dài

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
