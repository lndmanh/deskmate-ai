# Task A1 — Setup & Cài đặt AI SDK

**Priority:** CRITICAL — làm trước tất cả  
**Model:** Haiku | **Effort:** default  
**Thư mục làm việc:** `apps/desktop/`

## Goal

Cài `ai` và `@ai-sdk/openai` vào Electron project. Cấu hình TypeScript để nhận diện các types. Tạo file cấu hình trung tâm cho AI client.

## Commands

```bash
cd apps/desktop
npm install ai @ai-sdk/openai electron-store zod
```

## Files to Create

```
src/main/features/chat/
  config.ts       ← model config, default params
  types.ts        ← shared types dùng chung main + preload
```

## config.ts

```typescript
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
```

## types.ts

```typescript
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
```

## Definition of Done

- [ ] `npm install` chạy không lỗi
- [ ] `npx tsc --noEmit` không báo lỗi liên quan đến `ai` hoặc `@ai-sdk/openai`
- [ ] Import `createOpenAI` từ `@ai-sdk/openai` không lỗi trong main process file
