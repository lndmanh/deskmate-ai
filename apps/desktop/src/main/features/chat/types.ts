// src/main/features/chat/types.ts
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamChunkEvent {
  streamId: string
  delta: string
}

export interface StreamDoneEvent {
  streamId: string
  finishReason: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
}

export interface StreamErrorEvent {
  streamId: string
  error: string
  partialText: string
}

export interface ChatRequest {
  streamId: string
  messages: ChatMessage[]
  context?: DeskMateContext
}

export interface DeskMateContext {
  postureStatus?: string
  postureScore?: number
  breakDebt?: string
  fatigueRisk?: string
  activeTimeMinutes?: number
  latestMood?: string
}
