// src/renderer/src/lib/stream-id.ts
export function generateStreamId(): string {
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
