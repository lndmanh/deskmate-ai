// src/main/features/chat/config.ts
import { createOpenAI } from '@ai-sdk/openai'

export const CHAT_CONFIG = {
  model: 'gpt-4o-mini',           // default model — cheap, fast, good enough
  maxTokens: 1024,
  temperature: 0.7,
  maxRetries: 3,
  streamTimeoutMs: 30_000,
} as const

export function createOpenAIClient(apiKey: string) {
  return createOpenAI({ apiKey })
}
